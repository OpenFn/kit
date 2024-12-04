import test from 'ava';
import fs from 'node:fs/promises';
import mockfs from 'mock-fs';
import { createMockLogger } from '@openfn/logger';

import configurationHandler from "../../src/configuration/handler";
import { ConfigOptions } from '../../src/configuration/command';

const logger = createMockLogger();

const MOCK_ADAPTOR = '@openfn/language-dhis2';

const sample_config = {
    "hostUrl": "https://play.dhis2.org/2.36.6",
    "password": "@some(!)Password",
    "username": "admin"
}

const full_schema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "properties": {
        "hostUrl": {
            "title": "Host URL",
            "type": "string",
            "description": "The base DHIS2 instance URL",
            "format": "uri",
            "minLength": 1,
            "examples": [
                "https://play.dhis2.org/2.36.6"
            ]
        },
        "username": {
            "title": "Username",
            "type": "string",
            "description": "Username",
            "minLength": 1,
            "examples": [
                "admin"
            ]
        },
        "password": {
            "title": "Password",
            "type": "string",
            "description": "Password",
            "writeOnly": true,
            "minLength": 1,
            "examples": [
                "@some(!)Password"
            ]
        },
        "apiVersion": {
            "title": "API Version",
            "anyOf": [
                {
                    "type": "string"
                },
                {
                    "type": "null"
                }
            ],
            "placeholder": "38",
            "description": "DHIS2 api version",
            "minLength": 1,
            "examples": [
                "v2"
            ]
        }
    },
    "type": "object",
    "additionalProperties": true,
    "required": [
        "hostUrl",
        "password",
        "username"
    ]
}

const MOCK_OPTIONS: ConfigOptions = {
    logJson: false,
    outputPath: '',
    outputStdout: true,
    adaptor: MOCK_ADAPTOR,
};


// Helper function to load JSON from a file
const loadJSON = async (path: string) => {
    try {
        const result = await fs.readFile(path, 'utf8');
        if (result) {
            return JSON.parse(result);
        }
    } catch (e) {
        return null;
    }
};

test.beforeEach(() => {
    mockfs.restore();
    logger._reset();
    mockfs({
        '/mock/output/path': {},
    });
});

test.serial('fetch and process configuration', async (t) => {
    const configData = await configurationHandler(MOCK_OPTIONS, logger);

    const expectedResult = {
        sample_config,
        full_schema
    };
    t.deepEqual(configData, expectedResult);
});

test.serial('write configuration to file', async (t) => {
    const options: ConfigOptions = { ...MOCK_OPTIONS, outputPath: '/mock/output/path/configuration.json' };
    await configurationHandler(options, logger);

    const writtenData = await loadJSON('/mock/output/path/configuration.json');
    const expectedResult = {
        sample_config,
        full_schema
    };
    t.deepEqual(writtenData, expectedResult);
});

test.serial('filter configuration by schema option - schema', async (t) => {
    const optionsFull: ConfigOptions = { ...MOCK_OPTIONS, configType: 'schema' };

    const configDataFull = await configurationHandler(optionsFull, logger);
    t.deepEqual(configDataFull, { full_schema });
});

test.serial('filter configuration by schema option - sample', async (t) => {
    const optionsSample: ConfigOptions = { ...MOCK_OPTIONS, configType: 'sample' };

    const configDataSample = await configurationHandler(optionsSample, logger);
    t.deepEqual(configDataSample, { sample_config });
});

