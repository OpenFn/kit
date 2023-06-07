type DeployErrorName =
  | 'VALIDATION_ERROR'
  | 'DEPLOY_ERROR'
  | 'CONFIG_ERROR'
  | 'STATE_ERROR'
  | 'SPEC_ERROR';

export class DeployError extends Error {
  name: DeployErrorName;

  constructor(message: string, name: DeployErrorName) {
    super(message);
    Object.setPrototypeOf(this, DeployError.prototype);
    this.name = name;
  }
}
