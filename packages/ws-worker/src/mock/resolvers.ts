import type { State, Credential } from '../types';
import { Resolvers } from '@openfn/engine-multi';

const mockResolveCredential = (_credId: string) =>
  new Promise<Credential>((resolve) =>
    resolve({
      user: 'user',
      password: 'pass',
    })
  );

const mockResolveState = (_stateId: string) =>
  new Promise<State>((resolve) =>
    resolve({
      data: {},
    })
  );

const mockResolveExpressions = (_stateId: string) =>
  new Promise<string>((resolve) => resolve('{ data: { answer: 42 } }'));

export default {
  credentials: mockResolveCredential,
  state: mockResolveState,
  expressions: mockResolveExpressions,
} as Resolvers;
