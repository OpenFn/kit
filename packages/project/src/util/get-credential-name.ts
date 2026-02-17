import { Credential } from '../Project';
import slugify from './slugify';

export default (cred: Credential) => `${cred.owner}-${slugify(cred.name)}`;
