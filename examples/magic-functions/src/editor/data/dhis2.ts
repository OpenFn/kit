// TODO let's pretend that the adaptor ships this type definition
export default `
// TODO are attributes bound to anything, like a particular org id or entity type?
type Dhis2Attribute = {
  
  /**
   * The attribute id
   * @lookup $.attributes[*]
   */
  attribute: string;

  value: any;
}

type Dhis2Data = {
  /**
   * The id of an organisation unit
   * @lookup $.orgUnits[*]
   */
  orgUnit?: string;

  /**
   * Tracked instance id
   */
  trackedEntityInstance?: string;

  /**
   * Tracked instance type
   * @lookup $.trackedEntityTypes[*]
   */
  trackedEntityType?: string;

  /**
   * List of attributes
   */
  attributes?: Dhis2Attribute[];
};

declare module '@openfn/language-dhis2' {
 /**
  * Create a record
  * @public
  * @constructor
  * @param {string} resourceType - Type of resource to create.
  * @paramlookup resourceType $.resourceTypes[*]
  * @param {Dhis2Data} data - Data that will be used to create a given instance of resource.
  * @param {Object} [options] - Optional options to define URL parameters via params.
  * @param {function} [callback] - Optional callback to handle the response
  * @returns {Operation}
  * 
  */
 export function create(resourceType: string, data: Dhis2Data, options = {}, callback = false): Operation;
}
`;
