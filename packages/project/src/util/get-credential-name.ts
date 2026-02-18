import { Credential } from '../Project';

export const DELIMETER = '|';

export default (cred: Credential) => `${cred.owner}${DELIMETER}${cred.name}`;

export const parse = (credentialName: string) => {
  const [owner, name] = credentialName.split('|');
  return { owner, name };
};
