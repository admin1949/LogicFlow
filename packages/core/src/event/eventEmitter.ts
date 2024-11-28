import { EventArgs } from './eventArgs'

export type EventType<T extends string = string> = {
  readonly callback: EventCallback<T>
  readonly once: boolean
}

export type EventsType<T extends string = string> = {
  [k in T]?: EventType<k>[]
}

export type CallbackArgs<T extends string = string> = T extends keyof EventArgs
  ? EventArgs[T]
  : // 如果不是内部定义的事件类型，那么允许用户抛出任何类型的参数
    // 这部分的类型定义由用户自己来保证
    any

export type EventCallback<T extends string = string> = (
  args: CallbackArgs<T>,
) => void

const WILDCARD = '*'

export interface OnEvent {
  <T extends keyof EventArgs>(
    evt: T,
    callback: EventCallback<T>,
    once?: boolean,
  ): ClearCallback
  <T extends string>(
    evt: T,
    callback: EventCallback<T>,
    once?: boolean,
  ): ClearCallback
}

export interface OnceEvent {
  <T extends keyof EventArgs>(evt: T, callback: EventCallback<T>): ClearCallback
  <T extends string>(evt: T, callback: EventCallback<T>): ClearCallback
}

interface ClearCallback {
  (): void
  on: OnEvent
  once: OnceEvent
}

/* event-emitter */
export default class EventEmitter {
  private _events: EventsType = {}

  /**
   * 监听一个事件
   * @param evt 事件名称
   * @param callback 回调函数
   * @param once 是否只监听一次
   * @returns { ClearCallback } 返回支持链式调用的清除函数
   * @example
   * const bus = new EventEmitter();
   * const off = bus
   *  .on("e1", () => {})
   *  .once("e2", () => {})
   *  .on("e3", () => {});
   *
   * off() // 清除这一次注册的 e1、e2、e3 事件
   */
  on: OnEvent = (
    evt: string,
    callback: EventCallback,
    once?: boolean,
  ): ClearCallback => {
    evt?.split(',').forEach((evKey) => {
      evKey = evKey.trim()
      if (!this._events[evKey]) {
        this._events[evKey] = []
      }
      this._events[evKey]!.push({
        callback,
        once: !!once,
      })
    })

    return createClearCallback(this, () => {
      if (evt) {
        this.off(evt, callback)
      }
    })
  }

  /**
   * 监听一个事件一次
   * @param evt 事件名称
   * @param callback 回调函数
   * @returns { ClearCallback } 返回支持链式调用的清除函数
   * @example
   * const bus = new EventEmitter();
   * const off = bus
   *  .on("e4", () => {})
   *  .once("e5", () => {})
   *  .on("e6", () => {});
   *
   * off() // 清除这一次注册的 e4、e5、e6 事件
   */
  once: OnceEvent = (evt: string, callback: EventCallback): ClearCallback => {
    evt?.split(',').forEach((evKey) => {
      evKey = evKey.trim()
      this.on(evKey, callback, true)
    })

    return createClearCallback(this, () => {
      if (evt) {
        this.off(evt, callback)
      }
    })
  }

  /**
   * 触发一个事件
   * @param evts
   * @param eventArgs
   */
  emit<T extends keyof EventArgs>(evts: T, eventArgs: CallbackArgs<T>): void
  emit<T extends string>(evts: T, eventArgs: CallbackArgs<T>): void
  emit(evts: string, eventArgs?: EventCallback) {
    evts?.split(',').forEach((evt) => {
      const events = this._events[evt] || []
      const wildcardEvents = this._events[WILDCARD] || []
      // 实际的处理 emit 方法
      const doEmit = (es: EventType[]) => {
        let { length } = es
        for (let i = 0; i < length; i++) {
          if (!es[i]) {
            continue
          }
          const { callback, once } = es[i]
          if (once) {
            es.splice(i, 1)
            if (es.length === 0) {
              delete this._events[evt]
            }
            length--
            i--
          }
          callback.apply(this, [eventArgs])
        }
      }
      doEmit(events)
      doEmit(wildcardEvents)
    })
  }

  /**
   * 取消事件监听
   * @param evts 事件名称
   * @param callback 回调函数
   *
   * - evts 为空时，清除所有事件的监听器
   * - evts 非空，callback 为空时，清除指定事件的所有监听器
   * - evts 非空，callback 非空，进行对象比较，清除指定事件的指定监听器
   */
  off<T extends keyof EventArgs>(
    evts: T,
    callback?: (args: EventArgs[T]) => void,
  ): void
  off<T extends string>(evts: T, callback?: EventCallback<T>): void
  off(evts: string, callback?: EventCallback) {
    if (!evts) {
      // evt 为空全部清除
      this._events = {}
    }
    evts.split(',').forEach((evt) => {
      if (!callback) {
        // evt 存在，callback 为空，清除事件所有方法
        delete this._events[evt]
      } else {
        // evt 存在，callback 存在，清除匹配的
        const events = this._events[evt] || []
        let { length } = events
        for (let i = 0; i < length; i++) {
          if (events[i].callback === callback) {
            events.splice(i, 1)
            length--
            i--
          }
        }
        if (events.length === 0) {
          delete this._events[evt]
        }
      }
    })
  }

  /* 当前所有的事件 */
  getEvents() {
    return this._events
  }
}

const createClearCallback = (
  ctx: EventEmitter,
  clear: () => void,
): ClearCallback => {
  const preClear = clear as ClearCallback

  preClear.on = (evt: string, callback: EventCallback, once?: boolean) => {
    const clear = ctx.on(evt, callback, once)
    return createClearCallback(ctx, () => {
      preClear()
      clear()
    })
  }

  preClear.once = (evt: string, callback: EventCallback) => {
    const clear = ctx.once(evt, callback)
    return createClearCallback(ctx, () => {
      preClear()
      clear()
    })
  }

  return preClear
}

export { EventEmitter, EventArgs }
