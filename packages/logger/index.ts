class Logger {
  name;

  constructor(name: string) {
    this.name = name;
  }


  // basic log function
  _log(state, level, messageOrString) {

  }

  // generic log method
  // what if some arguments are objects? or arrays?
  _logString() {

  }

  // basically pretty prints a json object
  // handle circular references
  // ignore underscores
  // sanitise sensitive fields
  _logObject() {

  }

  _isState: (obj) => obj.configuration && obj.data;

}