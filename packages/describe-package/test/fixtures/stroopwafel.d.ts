/**
 * Returns a traditional stroopwafel
 * @public
 * @example
 * traditional()
 */
export declare function traditional(): string;

/**
 * Returns a flavoured stroopwafel
 * @public
 * @example
 * custom('falafel')
 */
export declare function oneFlavour(flavour: string): string;

/**
 * Returns a many flavoured stroopwafel
 * @public
 * @example
 * custom(['strawberry', 'cream'])
 */
export declare function manyFlavours(flavours: string[]): string;

export declare function somethingPrivate(): void;

// Note that this is mocked by the helper project setup
export { fn } from '@openfn/language-common';
