// Copyright 2015-2021, University of Colorado Boulder

/**
 * Tandem defines a set of trees that are used to assign unique identifiers to PhetioObjects in PhET simulations and
 * notify listeners when the associated PhetioObjects have been added/removed. It is used to support PhET-iO.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import arrayRemove from '../../phet-core/js/arrayRemove.js';
import merge from '../../phet-core/js/merge.js';
import tandemNamespace from './tandemNamespace.js';

// constants
// Tandem can't depend on joist, so cannot use packageJSON module
const packageJSON = _.hasIn( window, 'phet.chipper.packageObject' ) ? phet.chipper.packageObject : { name: 'placeholder' };

const PHET_IO_ENABLED = _.hasIn( window, 'phet.preloads.phetio' );
const PRINT_MISSING_TANDEMS = PHET_IO_ENABLED && phet.preloads.phetio.queryParameters.phetioPrintMissingTandems;

// Validation defaults to true, but can be overridden to be false in package.json.
const IS_VALIDATION_DEFAULT = _.hasIn( packageJSON, 'phet.phet-io.validation' ) ? packageJSON.phet[ 'phet-io' ].validation : true;

// The default value for validation can be overridden with a query parameter ?phetioValidation={true|false}.
const IS_VALIDATION_QUERY_PARAMETER_SPECIFIED = window.QueryStringMachine && QueryStringMachine.containsKey( 'phetioValidation' );
const IS_VALIDATION_SPECIFIED = ( PHET_IO_ENABLED && IS_VALIDATION_QUERY_PARAMETER_SPECIFIED ) ? phet.preloads.phetio.queryParameters.phetioValidation :
                                ( PHET_IO_ENABLED && IS_VALIDATION_DEFAULT );

const VALIDATION = PHET_IO_ENABLED && IS_VALIDATION_SPECIFIED && !PRINT_MISSING_TANDEMS;

const REQUIRED_TANDEM_NAME = 'requiredTandem';
const OPTIONAL_TANDEM_NAME = 'optionalTandem';
const TEST_TANDEM_NAME = 'test';

// used to keep track of missing tandems.  Each element has type {{phetioID:{string}, stack:{string}}
const missingTandems = {
  required: [],
  optional: []
};

// Listeners that will be notified when items are registered/deregistered. See doc in addPhetioObjectListener
const phetioObjectListeners = [];

// {PhetioObject[]} - PhetioObjects that have been added before listeners are ready.
const bufferedPhetioObjects = [];

class Tandem {

  /**
   * Typically, sims will create tandems using `tandem.createTandem`.  This constructor is used internally or when
   * a tandem must be created from scratch.
   *
   * @param {Tandem|null} parentTandem - parent for a child tandem, or null for a root tandem
   * @param {string} name - component name for this level, like 'resetAllButton'
   * @param {Object} [options]
   */
  constructor( parentTandem, name, options ) {
    assert && assert( parentTandem === null || parentTandem instanceof Tandem, 'parentTandem should be null or Tandem' );
    assert && assert( typeof name === 'string', 'name must be defined' );
    assert && assert( this.getTermRegex().test( name ), `name should match the regex pattern: ${name}` );
    assert && assert( name !== Tandem.METADATA_KEY, 'name cannot match Tandem.METADATA_KEY' );

    // @public (read-only) {Tandem|null}
    this.parentTandem = parentTandem;

    // @public (read-only) - the last part of the tandem (after the last .), used e.g., in Joist for creating button
    // names dynamically based on screen names
    this.name = name;

    // @public (read-only)
    this.phetioID = this.parentTandem ? window.phetio.PhetioIDUtils.append( this.parentTandem.phetioID, this.name )
                                      : this.name;

    // options (even subtype options) must be stored so they can be passed through to children
    // Note: Make sure that added options here are also added to options for inheritance and/or for composition
    // (createTandem/parentTandem/getExtendedOptions) as appropriate.
    options = merge( {

      // required === false means it is an optional tandem
      required: true,

      // if the tandem is required but not supplied, an error will be thrown.
      supplied: true
    }, options );

    // @private {Object.<string, Tandem>}
    this.children = {};

    if ( this.parentTandem ) {
      assert && assert( !this.parentTandem.hasChild( name ), `parent should not have child: ${name}` );
      this.parentTandem.addChild( name, this );
    }

    // @private
    this.required = options.required;

    // @public (read-only)
    this.supplied = options.supplied;

    // @private
    this.isDisposed = false;
  }

  /**
   * Returns the regular expression which can be used to test each term. The term must consist only of alpha-numeric
   * characters or tildes.
   * @returns {RegExp}
   * @protected
   */
  getTermRegex() {
    return /^[a-zA-Z0-9[\],]+$/;
  }

  /**
   * If the provided tandem is not supplied, support the ?printMissingTandems query parameter for extra logging during
   * initial instrumentation.
   * @public
   * @param tandem
   */
  static onMissingTandem( tandem ) {
    assert && assert( tandem instanceof Tandem );

    // When the query parameter phetioPrintMissingTandems is true, report tandems that are required but not supplied
    if ( PRINT_MISSING_TANDEMS && !tandem.supplied ) {
      const stackTrace = new Error().stack;
      if ( tandem.required ) {
        missingTandems.required.push( { phetioID: this.phetioID, stack: stackTrace } );
      }
      else {

        // When the query parameter phetioPrintMissingTandems is true, report tandems that are optional but not
        // supplied, but not for Fonts because they are too numerous.
        if ( stackTrace.indexOf( 'Font' ) === -1 ) {
          missingTandems.optional.push( { phetioID: this.phetioID, stack: stackTrace } );
        }
      }
    }
  }

  /**
   * Adds a PhetioObject.  For example, it could be an axon Property, SCENERY/Node or SUN/RoundPushButton.
   * phetioEngine listens for when PhetioObjects are added and removed to keep track of them for PhET-iO.
   * @param {PhetioObject} phetioObject
   * @public
   */
  addPhetioObject( phetioObject ) {
    assert && assert( arguments.length === 1, 'Tandem.addPhetioObject takes one argument' );

    // Cannot use typical require statement for PhetioObject because it creates a module loading loop
    assert && assert( phetioObject instanceof tandemNamespace.PhetioObject, 'argument should be of type PhetioObject' );

    if ( PHET_IO_ENABLED ) {

      // Throw an error if the tandem is required but not supplied
      assert && Tandem.VALIDATION && assert( !( this.required && !this.supplied ), 'Tandem was required but not supplied' );

      // If tandem is optional and not supplied, then ignore it.
      if ( !this.required && !this.supplied ) {

        // Optionally instrumented types without tandems are not added.
        return;
      }

      if ( !Tandem.launched ) {
        bufferedPhetioObjects.push( phetioObject );
      }
      else {
        for ( let i = 0; i < phetioObjectListeners.length; i++ ) {
          phetioObjectListeners[ i ].addPhetioObject( phetioObject );
        }
      }
    }
  }

  /**
   * Returns true if this Tandem has the specified ancestor Tandem.
   * @param {Tandem} ancestor
   * @returns {boolean}
   * @public
   */
  hasAncestor( ancestor ) {
    return this.parentTandem === ancestor || ( this.parentTandem && this.parentTandem.hasAncestor( ancestor ) );
  }

  /**
   * Removes a PhetioObject and signifies to listeners that it has been removed.
   * @param {PhetioObject} phetioObject
   * @public
   */
  removePhetioObject( phetioObject ) {

    if ( !this.required && !this.supplied ) {
      return;
    }

    // Only active when running as phet-io
    if ( PHET_IO_ENABLED ) {
      if ( !Tandem.launched ) {
        assert && assert( bufferedPhetioObjects.indexOf( phetioObject ) >= 0, 'should contain item' );
        arrayRemove( bufferedPhetioObjects, phetioObject );
      }
      else {
        for ( let i = 0; i < phetioObjectListeners.length; i++ ) {
          phetioObjectListeners[ i ].removePhetioObject( phetioObject );
        }
      }
    }

    phetioObject.tandem.dispose();
  }

  /**
   * Used for creating new tandems, extends this Tandem's options with the passed-in options.
   * @param {Object} [options]
   * @returns {Object} -extended options
   * @public
   */
  getExtendedOptions( options ) {

    // Any child of something should be passed all inherited options. Make sure that this extend call includes all
    // that make sense from the constructor's extend call.
    return merge( {
      supplied: this.supplied,
      required: this.required
    }, options );
  }

  /**
   * Create a new Tandem by appending the given id, or if the child Tandem already exists, return it instead.
   * @param {string} name
   * @param {Object} [options]
   * @returns {Tandem}
   * @public
   */
  createTandem( name, options ) {

    options = this.getExtendedOptions( options );

    // re-use the child if it already exists, but make sure it behaves the same.
    if ( this.hasChild( name ) ) {
      const currentChild = this.children[ name ];
      assert && assert( currentChild.required === options.required );
      assert && assert( currentChild.supplied === options.supplied );
      assert && assert( currentChild instanceof Tandem );
      return currentChild;
    }
    else {
      return new Tandem( this, name, options );
    }
  }

  /**
   * @param {string} name
   * @returns {boolean}
   * @private
   */
  hasChild( name ) {
    return this.children.hasOwnProperty( name );
  }

  /**
   * @param {string} name
   * @param {Tandem} tandem
   * @public
   */
  addChild( name, tandem ) {
    assert && assert( !this.hasChild( name ) );
    this.children[ name ] = tandem;
  }

  /**
   * Fire a callback on all descendants of this Tandem
   * @param {function(Tandem)} callback
   * @public
   */
  iterateDescendants( callback ) {
    for ( const childName in this.children ) {
      if ( this.children.hasOwnProperty( childName ) ) {
        callback( this.children[ childName ] );
        this.children[ childName ].iterateDescendants( callback );
      }
    }
  }

  /**
   * @param {string} childName
   * @private
   */
  removeChild( childName ) {
    assert && assert( this.hasChild( childName ) );
    delete this.children[ childName ];
  }

  /**
   * @private
   */
  dispose() {
    assert && assert( !this.isDisposed, 'already disposed' );

    this.parentTandem.removeChild( this.name );

    this.isDisposed = true;
  }

  /**
   * For API validation, each PhetioObject has a corresponding concrete PhetioObject for comparison. Non-dynamic
   * PhetioObjects have the trivial case where its archetypal phetioID is the same as its phetioID.
   * @returns {string}
   * @public
   */
  getArchetypalPhetioID() {

    // Dynamic elements always have a parent container, hence since this does not have a parent, it must already be concrete
    return this.parentTandem ? window.phetio.PhetioIDUtils.append( this.parentTandem.getArchetypalPhetioID(), this.name ) : this.phetioID;
  }

  /**
   * Creates a group tandem for creating multiple indexed child tandems, such as:
   * sim.screen.model.electron0
   * sim.screen.model.electron1
   *
   * In this case, 'sim.screen.model.electron' is the string passed to createGroupTandem.
   *
   * Used for arrays, observable arrays, or when many elements of the same type are created and they do not otherwise
   * have unique identifiers.
   * @param {string} name
   * @returns {GroupTandem}
   * @public
   */
  createGroupTandem( name ) {
    if ( this.children[ name ] ) {
      return this.children[ name ];
    }
    return new GroupTandem( this, name );
  }

  /**
   * @param {Tandem} tandem
   * @returns {boolean}
   * @public
   */
  equals( tandem ) {
    return this.phetioID === tandem.phetioID;
  }

  /**
   * Adds a listener that will be notified when items are registered/deregistered
   * Listeners have the form
   * {
   *   addPhetioObject(id,phetioObject),
   *   removePhetioObject(id,phetioObject)
   * }
   * where id is of type {string} and phetioObject is of type {PhetioObject}
   *
   * @param {Object} phetioObjectListener - described above
   * @public
   * @static
   */
  static addPhetioObjectListener( phetioObjectListener ) {
    phetioObjectListeners.push( phetioObjectListener );
  }

  /**
   * After all listeners have been added, then Tandem can be launched.  This registers all of the buffered PhetioObjects
   * and subsequent PhetioObjects will be registered directly.
   * @public (phetioEngine PhetioObjectTests)
   * @static
   */
  static launch() {
    assert && assert( !Tandem.launched, 'Tandem cannot be launched twice' );
    Tandem.launched = true;
    while ( bufferedPhetioObjects.length > 0 ) {
      const phetioObject = bufferedPhetioObjects.shift();
      phetioObject.tandem.addPhetioObject( phetioObject );
    }
    assert && assert( bufferedPhetioObjects.length === 0, 'bufferedPhetioObjects should be empty' );
  }

  /**
   * ONLY FOR TESTING!!!!
   * This was created to "undo" launch so that tests can better expose cases around calling Tandem.launch()
   * @public (tests only)
   */
  static unlaunch() {
    Tandem.launched = false;
    bufferedPhetioObjects.length = 0;
  }
}

// @public (read-only) - a list of PhetioObjects ready to be sent out to listeners, but can't because Tandem hasn't been
// launched yet.
Tandem.bufferedPhetioObjects = bufferedPhetioObjects;

class RootTandem extends Tandem {

  /**
   * RootTandems only accept specifically named children.
   * @override
   * @param {string} name
   * @param {Object} [options]
   * @returns {Tandem}
   * @public
   */
  createTandem( name, options ) {
    if ( Tandem.VALIDATION ) {
      const allowedOnRoot = name === window.phetio.PhetioIDUtils.GLOBAL_COMPONENT_NAME ||
                            name === REQUIRED_TANDEM_NAME ||
                            name === OPTIONAL_TANDEM_NAME ||
                            name === TEST_TANDEM_NAME ||
                            name === window.phetio.PhetioIDUtils.GENERAL_COMPONENT_NAME ||
                            _.endsWith( name, 'Screen' );
      assert && assert( allowedOnRoot, `tandem name not allowed on root: "${name}"; perhaps try putting it under general or global` );
    }

    return super.createTandem( name, options );
  }
}

// The next few statics are created outside the static block because they instantiate Tandem instances.

/**
 * The root tandem for a simulation
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.ROOT = new RootTandem( null, _.camelCase( packageJSON.name ) );

/**
 * Many simulation elements are nested under "general". This tandem is for elements that exists in all sims. For a
 * place to put simulation specific globals, see `GLOBAL`
 *
 * @constant
 * @type {Tandem}
 */
const GENERAL = Tandem.ROOT.createTandem( window.phetio.PhetioIDUtils.GENERAL_COMPONENT_NAME );

/**
 * Used in unit tests
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.ROOT_TEST = Tandem.ROOT.createTandem( TEST_TANDEM_NAME );
/**
 * Tandem for model simulation elements that are general to all sims.
 *
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.GENERAL_MODEL = GENERAL.createTandem( window.phetio.PhetioIDUtils.MODEL_COMPONENT_NAME );

/**
 * Tandem for view simulation elements that are general to all sims.
 *
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.GENERAL_VIEW = GENERAL.createTandem( window.phetio.PhetioIDUtils.VIEW_COMPONENT_NAME );

/**
 * Tandem for controller simulation elements that are general to all sims.
 *
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.GENERAL_CONTROLLER = GENERAL.createTandem( window.phetio.PhetioIDUtils.CONTROLLER_COMPONENT_NAME );

/**
 * Simulation elements that don't belong in screens should be nested under "global". Note that this tandem should only
 * have simulation specific elements in them. Instrument items used by all sims under `Tandem.GENERAL`. Most
 * likely simulations elements should not be directly under this, but instead either under the model or view sub
 * tandems.
 *
 * @constant
 * @type {Tandem}
 */
const GLOBAL = Tandem.ROOT.createTandem( window.phetio.PhetioIDUtils.GLOBAL_COMPONENT_NAME );

/**
 * Model simulation elements that don't belong in specific screens should be nested under this Tandem. Note that this
 * tandem should only have simulation specific elements in them.
 *
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.GLOBAL_MODEL = GLOBAL.createTandem( window.phetio.PhetioIDUtils.MODEL_COMPONENT_NAME );

/**
 * View simulation elements that don't belong in specific screens should be nested under this Tandem. Note that this
 * tandem should only have simulation specific elements in them.
 *
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.GLOBAL_VIEW = GLOBAL.createTandem( window.phetio.PhetioIDUtils.VIEW_COMPONENT_NAME );

/**
 * Colors used in the simulation.
 *
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.COLORS = Tandem.GLOBAL_VIEW.createTandem( window.phetio.PhetioIDUtils.COLORS_COMPONENT_NAME );

/**
 * Used to indicate a common code component that supports tandem, but doesn't not require it.  If a tandem is not
 * passed in, then it will not be instrumented.
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.OPTIONAL = Tandem.ROOT.createTandem( OPTIONAL_TANDEM_NAME, {
  required: false,
  supplied: false
} );

/**
 * To be used exclusively to opt out of situations where a tandem is required.
 * See https://github.com/phetsims/tandem/issues/97.
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.OPT_OUT = Tandem.OPTIONAL;

/**
 * Some common code (such as Checkbox or RadioButton) must always be instrumented.
 * @public
 * @constant
 * @type {Tandem}
 */
Tandem.REQUIRED = Tandem.ROOT.createTandem( REQUIRED_TANDEM_NAME, {

  // let phetioPrintMissingTandems bypass this
  required: VALIDATION || PRINT_MISSING_TANDEMS,
  supplied: false
} );

/**
 * Expose collected missing tandems only populated from specific query parameter, see phetioPrintMissingTandems
 * @public (phet-io internal)
 * @type {Object}
 */
Tandem.missingTandems = missingTandems;

/**
 * If PhET-iO is enabled in this runtime.
 * @public
 * @type {boolean}
 */
Tandem.PHET_IO_ENABLED = PHET_IO_ENABLED;

/**
 * When generating an API (whether to output a file or for in-memory comparison), this is marked as true.
 * @public
 * @type {boolean}
 */
Tandem.API_GENERATION = Tandem.PHET_IO_ENABLED && ( phet.preloads.phetio.queryParameters.phetioPrintAPI ||
                                                    phet.preloads.phetio.queryParameters.phetioCompareAPI );

/**
 * If PhET-iO is running with validation enabled.
 * @public
 * @type {boolean}
 */
Tandem.VALIDATION = VALIDATION;

/**
 * For the API file, the key name for the metadata section.
 * @type {string}
 * @public
 */
Tandem.METADATA_KEY = '_metadata';

/**
 * For the API file, the key name for the data section.
 * @type {string}
 * @public
 */
Tandem.DATA_KEY = '_data';

/**
 * Group Tandem -- Declared in the same file to avoid circular reference errors in module loading.
 */
class GroupTandem extends Tandem {

  /**
   * @param {Tandem} parentTandem
   * @param {string} name
   * @constructor
   * @private create with Tandem.createGroupTandem
   */
  constructor( parentTandem, name ) {
    super( parentTandem, name );

    // @private
    this.groupName = name;

    // @private for generating indices from a pool
    this.groupMemberIndex = 0;
  }

  /**
   * Creates the next tandem in the group.
   * @returns {Tandem}
   * @public
   */
  createNextTandem() {
    const tandem = this.parentTandem.createTandem( `${this.groupName}${this.groupMemberIndex}` );
    this.groupMemberIndex++;
    return tandem;
  }
}

// @public (read-only) Before listeners are wired up, tandems are buffered.  When listeners are wired up,
// Tandem.launch() is called and buffered tandems are flushed, then subsequent tandems are delivered to listeners
// directly
Tandem.launched = false;

tandemNamespace.register( 'Tandem', Tandem );
export default Tandem;