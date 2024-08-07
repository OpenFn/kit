import { Logger } from '../util/logger';
import { ConfigOptions } from './command';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const configurationHandler = async (options: ConfigOptions, logger: Logger) => {
    logger.always(`Retrieving configuration for: ${options.adaptor}`);

    const { adaptor } = options;

    try {
        const configData = await getConfig(adaptor, logger);
        const filteredConfigData = filterConfigData(configData, options.configType);

        await serializeOutput(options, filteredConfigData, logger);

        logger.success('Done!');
        return filteredConfigData;
    } catch (error: any) {
        logger.error(`Failed to retrieve configuration`);
        logger.error(error);
    }
};

const getConfig = async (adaptor: string, logger: Logger) => {
    // Fetch the configuration-schema.json file from the CDN
    const configPath = `${adaptor}/configuration-schema.json`;

    logger.always("Fetching configuration file...");
    const configContent = await fetchFile(configPath, logger);
    const fullSchema = JSON.parse(configContent);

    // Extract required fields and their examples
    const requiredFields = fullSchema.required || [];
    const properties = fullSchema.properties || {};
    const sampleConfig: Record<string, any> = {};

    requiredFields.forEach((field: string) => {
        const fieldInfo = properties[field];
        if (fieldInfo && fieldInfo.examples && fieldInfo.examples.length > 0) {
            sampleConfig[field] = fieldInfo.examples[0];
        }
    });

    const configData = {
        sample_config: sampleConfig,
        full_schema: fullSchema,
    };

    return configData;
};

const filterConfigData = (configData: any, schemaOption: string | undefined) => {
    switch (schemaOption) {
        case 'sample':
            return { sample_config: configData.sample_config };
        case 'schema':
            return { full_schema: configData.full_schema };
        case 'both':
        default:
            return configData;
    }
};

const write = async (
    basePath: string,
    filePath: string,
    content: string,
    logger: Logger
) => {
    const ext = path.extname(basePath);
    let dir;
    if (ext) {
        dir = path.dirname(path.resolve(basePath));
    } else {
        dir = basePath;
    }

    // Ensure the root dir exists
    await mkdir(dir, { recursive: true });

    const dest = path.resolve(basePath, filePath);
    await writeFile(dest, content);

    logger.success(`Wrote content to ${dest}`);
};

// Serialize output to file and stdout
const serializeOutput = async (
    options: Pick<ConfigOptions, 'outputStdout' | 'outputPath'>,
    result: any,
    logger: Logger
) => {
    /** Print to disk **/
    if (options.outputPath) {
        await write(
            options.outputPath,
            '',
            JSON.stringify(result, null, 2),
            logger
        );
    }

    /** print to stdout **/
    logger.success('Configuration Data:');
    logger.always(JSON.stringify(result, undefined, 2));
};

async function fetchFile(path: string, logger: Logger) {
    const resolvedPath = `https://cdn.jsdelivr.net/npm/${path}`;

    logger.debug("Fetching configuration from: ", resolvedPath);
    const response = await fetch(resolvedPath);

    if (response.status === 200) {
        return response.text();
    }

    throw new Error(
        `Failed getting file at: ${path} got: ${response.status} ${response.statusText}`
    );
}

export default configurationHandler;
