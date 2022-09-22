declare interface State<D = object, C = object> {
  configuration: C;
  data: D;
  references?: Array<any>;
  index?: number;
}

declare interface Operation<T = Promise<State> | State> {
  (state: State): T;
}
