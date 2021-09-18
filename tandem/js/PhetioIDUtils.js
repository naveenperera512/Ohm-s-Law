// Copyright 2017-2021, University of Colorado Boulder

/**
 * Utilities for creating and manipulating the unique identifiers assigned to instrumented PhET-iO instances, aka
 * phetioIDs.
 *
 * Many of these functions' jsdoc is rendered and visible publicly to PhET-iO client. Those sections should be
 * marked, see top level comment in Client.js about private vs public documentation
 *
 * @author Chris Malley (PixelZoom, Inc.)
 * @author Sam Reid (PhET Interactive Simulations)
 */
( function() {
  

  // define the phetio global
  window.phetio = window.phetio || {};

  // constants
  const SEPARATOR = '.';
  const GROUP_SEPARATOR = '_';
  const GENERAL_COMPONENT_NAME = 'general';
  const GLOBAL_COMPONENT_NAME = 'global';
  const HOME_SCREEN_COMPONENT_NAME = 'homeScreen';
  const MODEL_COMPONENT_NAME = 'model';
  const VIEW_COMPONENT_NAME = 'view';
  const COLORS_COMPONENT_NAME = 'colors';
  const CONTROLLER_COMPONENT_NAME = 'controller';

  /**
   * Helpful methods for manipulating phetioIDs. Used to minimize the amount of duplicated logic specific to the string
   * structure of the phetioID. Available in the main PhET-iO js import.
   * @namespace
   */
  window.phetio.PhetioIDUtils = {

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * Appends a component to an existing phetioID to create a new unique phetioID for the component.
     * @example
     * append( 'myScreen.myControlPanel', 'myComboBox' )
     * -->  'myScreen.myControlPanel.myComboBox'
     * @public
     * @param {string} phetioID - the ID of the PhET-iO element
     * @param {string|string[]} componentNames - the name or list of names to append to the ID
     * @returns {string} - the appended phetioID
     */
    append: function( phetioID, ...componentNames ) {
      componentNames.forEach( componentName => {
        assert && assert( componentName.indexOf( SEPARATOR ) === -1, `separator appears in componentName: ${componentName}` );
        phetioID += SEPARATOR + componentName;
      } );
      return phetioID;
    },

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * Given a phetioID for a PhET-iO element, get the part of that ID that pertains to the component (basically the
     * tail piece).
     * @example
     * getComponentName( 'myScreen.myControlPanel.myComboBox' )
     * -->  'myComboBox'
     * @public
     * @param {string} phetioID - the ID of the PhET-iO element
     * @returns {string} - the component name
     */
    getComponentName: function( phetioID ) {
      assert && assert( phetioID.length > 0 );
      const indexOfLastSeparator = phetioID.lastIndexOf( SEPARATOR );
      if ( indexOfLastSeparator === -1 ) {
        return phetioID;
      }
      else {
        return phetioID.substring( indexOfLastSeparator + 1, phetioID.length );
      }
    },

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * Given a phetioID for a PhET-iO element, get the phetioID of the parent component.
     * @example
     * getParentID( 'myScreen.myControlPanel.myComboBox' )
     * -->  'myScreen.myControlPanel'
     * @public
     * @param {string} phetioID - the ID of the PhET-iO element
     * @returns {string|null} - the phetioID of the parent, or null if there is no parent
     */
    getParentID: function( phetioID ) {
      const indexOfLastSeparator = phetioID.lastIndexOf( SEPARATOR );
      return indexOfLastSeparator === -1 ? null : phetioID.substring( 0, indexOfLastSeparator );
    },

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * Given a phetioID for a instrumented object, get a string that can be used to assign an ID to a DOM element
     * @param {string} phetioID - the ID of the PhET-iO element
     * @returns {string}
     * @public
     */
    getDOMElementID: function( phetioID ) {
      return `phetioID:${phetioID}`;
    },

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * Get the screen id from the phetioID.
     * @example
     * getScreenID( 'sim.myScreen.model.property' )
     * --> sim.myScreen
     * getScreenID( 'sim.myScreen' )
     * --> sim.myScreen
     * getScreenID( 'sim.general.activeProperty' )
     * --> null
     * @param {string} phetioID
     * @returns {string|null} - null if there is no screen component name in the phetioID
     */
    getScreenID: function( phetioID ) {
      const screenIDParts = [];
      const phetioIDParts = phetioID.split( SEPARATOR );
      for ( let i = 0; i < phetioIDParts.length; i++ ) {
        const componentPart = phetioIDParts[ i ];
        screenIDParts.push( componentPart );
        const screenMarker = 'Screen';
        const indexOfScreenMarker = componentPart.indexOf( screenMarker );
        if ( indexOfScreenMarker > 0 && indexOfScreenMarker + screenMarker.length === componentPart.length ) { // endsWith proxy
          return screenIDParts.join( SEPARATOR );
        }
      }
      return null;
    },

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * Get the index number from the component name of the component name provided.
     * @param {string} componentName
     * @returns {number}
     * @example
     * getGroupElementIndex( 'particle_1' )
     * --> 1
     * @public
     */
    getGroupElementIndex: function( componentName ) {
      assert && assert( componentName.indexOf( window.phetio.PhetioIDUtils.GROUP_SEPARATOR ) >= 0,
        'component name for phetioID should have group element syntax' );
      return parseInt( componentName.split( window.phetio.PhetioIDUtils.GROUP_SEPARATOR )[ 1 ], 10 );
    },

    /**
     * Returns true if the potential ancestor is indeed an ancestor of the potential descendant, but not the same phetioID
     * @param {string} potentialAncestorPhetioID
     * @param {string} potentialDescendantPhetioID
     * @returns {boolean}
     * @public
     */
    isAncestor: function( potentialAncestorPhetioID, potentialDescendantPhetioID ) {
      const ancestorComponents = potentialAncestorPhetioID.split( SEPARATOR );
      const descendantComponents = potentialDescendantPhetioID.split( SEPARATOR );
      for ( let i = 0; i < ancestorComponents.length; i++ ) {
        if ( ancestorComponents[ i ] !== descendantComponents[ i ] ) {
          return false;
        }
      }

      // not the same child
      return potentialDescendantPhetioID !== potentialAncestorPhetioID;
    },

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The separator used to piece together a phet-io ID.
     * @type {string}
     * @constant
     * @public
     */
    SEPARATOR: SEPARATOR,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The separator used to specify the count of a element in a group.
     * @type {string}
     * @constant
     * @public
     */
    GROUP_SEPARATOR: GROUP_SEPARATOR,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The component name for the id section that holds phet-io elements general to all simulations.
     * @type {string}
     * @constant
     * @public
     */
    GENERAL_COMPONENT_NAME: GENERAL_COMPONENT_NAME,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The component name for the id section that holds simulation specific elements that don't belong in a screen.
     * @type {string}
     * @constant
     * @public
     */
    GLOBAL_COMPONENT_NAME: GLOBAL_COMPONENT_NAME,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The component name for the id section that holds the home screen.
     * @type {string}
     * @constant
     * @public
     */
    HOME_SCREEN_COMPONENT_NAME: HOME_SCREEN_COMPONENT_NAME,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The component name for an id section that holds model specific elements.
     * @type {string}
     * @constant
     * @public
     */
    MODEL_COMPONENT_NAME: MODEL_COMPONENT_NAME,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The component name for an id section that holds view specific elements.
     * @type {string}
     * @constant
     * @public
     */
    VIEW_COMPONENT_NAME: VIEW_COMPONENT_NAME,

    // Private Doc: The below jsdoc is public to the PhET-iO API documentation. Change wisely.
    /**
     * The component name for an id section that holds controller specific elements.
     * @type {string}
     * @constant
     * @public
     */
    CONTROLLER_COMPONENT_NAME: CONTROLLER_COMPONENT_NAME,

    /**
     * The component name for a section that holds colors
     * @type {string}
     * @constant
     * @public
     */
    COLORS_COMPONENT_NAME: COLORS_COMPONENT_NAME
  };
} )();