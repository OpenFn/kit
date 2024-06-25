/**
 * Returns a traditional stroopwafel
 * @function
 * @example
 * traditional()
 */
export declare function traditional(): string;

/**
 * Returns a flavoured stroopwafel
 * @function
 * @param {string} flavour
 * @magic flavour - $.children[*]
 * @example
 * <caption>cap</caption>oneFlavour('falafel')
 */
export declare function oneFlavour(flavour: string): string;

/**
 * Returns a many flavoured stroopwafel
 * @function
 * @example
 * manyFlavours(['strawberry', 'cream'])
 * @example
 * manyFlavours(['garlic', 'chilli'])
 */
export declare function manyFlavours(flavours: string[]): string;

export declare function somethingPrivate(): void;

// Note that this is mocked by the helper project setup
export { fn } from '@openfn/language-common';

export * as flavours from './stroopwafel-flavours';
