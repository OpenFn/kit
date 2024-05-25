import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';
import validate from '../../src/util/validate-plan';

const logger = createMockLogger('', { level: 'debug' });

test.afterEach(() => {
    logger._reset();
})

test('throws for missing workflow', (t) => {
    //@ts-ignore
    const plan: ExecutionPlan = {
        options: {
            start: 'a',
        }
    };

    t.throws(() => validate(plan, logger), {
        message: 'Missing or invalid workflow key in execution plan',
    });
});

test('throws for steps not an array', (t) => {
    //@ts-ignore
    const plan: ExecutionPlan = {
        options: {
            start: 'a',
        },
        workflow: {
            //@ts-ignore
            steps: {
                //@ts-ignore
                id: 'a'
            }
        },
    };

    t.throws(() => validate(plan, logger), {
        message: 'The workflow.steps key must be an array',
    });
});

test('throws for adaptor without an expression', (t) => {
    const plan: ExecutionPlan = {
        options: {
            start: 'a',
        },
        workflow: {
            steps: [
                {
                    id: 'a',
                    adaptor: 'z'
                }
            ],
        },
    };

    t.throws(() => validate(plan, logger), {
        message: 'Step a with an adaptor must also have an expression',
    });
});

test('throws for unknown key in a step', (t) => {
    const plan: ExecutionPlan = {
        options: {
            start: 'a',
        },
        workflow: {
            steps: [
                {
                    id: 'a',
                    //@ts-ignore
                    key: 'z'
                }
            ],
        },
    };

    t.throws(() => validate(plan, logger), {
        message: 'Invalid key "key" in step a',
    });
});

test.serial('should warn if no steps are defined', (t) => {
    const plan: ExecutionPlan = {
        options: {
            start: 'a',
        },
        workflow: {
            steps: [],
        },
    };
    validate(plan, logger);
    const { message, level } = logger._parse(logger._history[0]);
    t.is(level, 'warn');
    t.regex(message as string, /The workflow.steps array is empty/);
})

test.serial('should warn if unknown key is passed in options', (t) => {
    const plan: ExecutionPlan = {
        options: {
            start: 'a',
            //@ts-ignore
            key: 'z',
        },
        workflow: {
            steps: [{
                id: 'a',
            }],
        },
    };
    validate(plan, logger);
    const { message, level } = logger._parse(logger._history[0]);
    t.is(level, 'warn');
    t.regex(message as string, /Unrecognized option "key" in options object/);
})
