// Provide a fake dts for salesforce
// This is copied from adaptors, but looks a but sus!
export default `
declare module '@openfn/language-salesforce' {
  /**
   * Upsert an object.
   * @public
   * @example
   * upsert('obj_name', 'ext_id', {
   *   attr1: "foo",
   *   attr2: "bar"
   * })
   * @constructor
   * @param {String} sObject - API name of the sObject.
   * @paramLookup sObject $.children[?(@.type=="sobject" && !@.meta.system)].name
   * @param {String} externalId - ID.
   * @paramLookup externalId $.children[?(@.name=="{{args.sObject}}")].children[?(@.meta.externalId)].name
   * @param {Object} attrs - Field attributes for the new object.
   * @paramLookup attrs $.children[?(@.name=="{{args.sObject}}")].children[?(!@.meta.externalId)]
   * @param {State} state - Runtime state.
   * @returns {Operation}
   */
  export function upsert(sObject: string, externalId: string, attrs?: object, state?: any): Operation;
}
`;
