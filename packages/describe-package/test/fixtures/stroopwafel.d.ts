/**
 * Returns a traditional stroopwafel
 * @example
 * traditional()
 */
export declare function traditional(): string;

/**
 * Returns a flavoured stroopwafel
 * @example
 * custom('chocolate')
 */
export declare function oneFlavour(flavour: string): string;

/**
 * Returns a many flavoured stroopwafel
 * @example
 * custom(['chocolate', 'salt'])
 */
export declare function manyFlavours(flavours: string[]): string;
