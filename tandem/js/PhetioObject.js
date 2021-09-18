// Copyright 2017-2021, University of Colorado Boulder

/**
 * Base type that provides PhET-iO features. An instrumented PhetioObject is referred to on the wrapper side/design side
 * as a "PhET-iO element".  Note that sims may have hundreds or thousands of PhetioObjects, so performance and memory
 * considerations are important.  For this reason, initializePhetioObject is only called in PhET-iO brand, which means
 * many of the getters such as `phetioState` and `phetioDocumentation` will not work in other brands. We have opted
 * to have these getters throw assertion errors in other brands to help identify problems if these are called
 * unexpectedly.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import animationFrameTimer from '../../axon/js/animationFrameTimer.js';
import validate from '../../axon/js/validate.js';
import arrayRemove from '../../phet-core/js/arrayRemove.js';
import assertMutuallyExclusiveOptions from '../../phet-core/js/assertMutuallyExclusiveOptions.js';
import merge from '../../phet-core/js/merge.js';
import EventType from './EventType.js';
import LinkedElementIO from './LinkedElementIO.js';
import phetioAPIValidation from './phetioAPIValidation.js';
import Tandem from './Tandem.js';
import TandemConstants from './TandemConstants.js';
import tandemNamespace from './tandemNamespace.js';
import IOType from './types/IOType.js';

// constants
const PHET_IO_ENABLED = Tandem.PHET_IO_ENABLED;
const IO_TYPE_VALIDATOR = { valueType: IOType };
const BOOLEAN_VALIDATOR = { valueType: 'boolean' };

// use "<br>" instead of newlines
const PHET_IO_DOCUMENTATION_VALIDATOR = { valueType: 'string', isValidValue: doc => doc.indexOf( '\n' ) === -1 };
const PHET_IO_EVENT_TYPE_VALIDATOR = { valueType: EventType };
const OBJECT_VALIDATOR = { valueType: [ Object, null ] };

const objectToPhetioID = phetioObject => phetioObject.tandem.phetioID;

// When an event is suppressed from the data stream, we keep track of it with this token.
const SKIPPING_MESSAGE = -1;

const DEFAULTS = {

  // Subtypes can use `Tandem.tandemRequired` to require a named tandem passed in
  tandem: Tandem.OPTIONAL,

  // Defines API methods, events and serialization
  phetioType: IOType.ObjectIO,

  // {string} Useful notes about an instrumented PhetioObject, shown in the PhET-iO Studio Wrapper. It's an html
  // string, so "<br>" tags are required instead of "\n" characters for proper rendering in Studio
  phetioDocumentation: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioDocumentation,

  // When true, includes the PhetioObject in the PhET-iO state (not automatically recursive, must be specified for
  // children explicitly)
  phetioState: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioState,

  // This option controls how PhET-iO wrappers can interface with this PhetioObject. Predominately this occurs via
  // public methods defined on this PhetioObject's phetioType, in which some method are not executable when this flag
  // is true. See `ObjectIO.methods` for further documentation, especially regarding `invocableForReadOnlyElements`.
  phetioReadOnly: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioReadOnly,

  // Category of event type, can be overridden in phetioStartEvent options.  Cannot be supplied through TandemConstants because
  // that would create an import loop
  phetioEventType: EventType.MODEL,

  // High frequency events such as mouse moves can be omitted from data stream, see ?phetioEmitHighFrequencyEvents
  // and Client.launchSim option
  phetioHighFrequency: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioHighFrequency,

  // When true, emits events for data streams for playback, see handlePlaybackEvent.js
  phetioPlayback: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioPlayback,

  // When true, Studio is allowed to create a control for this PhetioObject (if it knows how)
  phetioStudioControl: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioStudioControl,

  // When true, this is categorized as an important "featured" element in Studio.
  phetioFeatured: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioFeatured,

  // {boolean} optional - indicates that an object may or may not have been created. Applies recursively automatically
  // and should only be set manually on the root dynamic element. Dynamic archetypes will have this overwritten to
  // false even if explicitly provided as true, as archetypes cannot be dynamic.
  phetioDynamicElement: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioDynamicElement,

  // {boolean} Marking phetioDesigned: true opts-in to API change detection tooling that can be used to catch inadvertent
  // changes to a designed API.  A phetioDesigned:true PhetioObject (or any of its tandem descendants) will throw
  // assertion errors on CT (or when running with ?phetioCompareAPI) when:
  // (a) its package.json lists compareDesignedAPIChanges:true in the "phet-io" section
  // (b) the simulation is listed in perennial/data/phet-io-api-stable
  // (c) any of its metadata values deviate from the reference API
  phetioDesigned: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioDesigned,

  // {Object|null} optional - delivered with each event, if specified. phetioPlayback is appended here, if true.
  // Note: unlike other options, this option can be mutated downstream, and hence should be created newly for each instance.
  phetioEventMetadata: null
};

assert && assert( EventType.phetioType.toStateObject( DEFAULTS.phetioEventType ) === TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioEventType,
  'phetioEventType must have the same default as the default metadata values.' );

class PhetioObject {

  /**
   * @param {Object} [options]
   */
  constructor( options ) {

    // @public (read-only) {Tandem} - assigned in initializePhetioObject - see docs at DEFAULTS declaration
    this.tandem = DEFAULTS.tandem;

    // @private {boolean} - track whether the object has been initialized.  This is necessary because initialization
    // can happen in the constructor or in a subsequent call to initializePhetioObject (to support scenery Node)
    this.phetioObjectInitialized = false;

    // @public (read-only) {boolean} - has it been disposed?
    this.isDisposed = false;

    if ( options ) {
      this.initializePhetioObject( {}, options );
    }

    if ( assert ) {

      // Wrap the prototype dispose method with a check. NOTE: We will not catch devious cases where the dispose() is
      // overridden after the Node constructor (which may happen).
      const protoDispose = this.dispose;
      this.dispose = () => {
        assert && assert( !this.isDisposed, 'This PhetioObject has already been disposed, and cannot be disposed again' );
        protoDispose.call( this );
        assert && assert( this.isDisposed, 'PhetioObject.dispose() call is missing from an overridden dispose method' );
      };
    }
  }

  /**
   * Like SCENERY/Node, PhetioObject can be configured during construction or later with a mutate call.
   * Noop if provided config keys don't intersect with any key in DEFAULTS; baseOptions are ignored for this calculation.
   *
   * @param {Object} baseOptions
   * @param {Object} config
   * @protected
   */
  initializePhetioObject( baseOptions, config ) {
    assert && assert( config, 'initializePhetioObject must be called with config' );

    // call before we exit early to support logging unsupplied Tandems.
    config.tandem && Tandem.onMissingTandem( config.tandem );

    // Make sure that required tandems are supplied
    if ( Tandem.VALIDATION && config.tandem && config.tandem.required ) {
      assert && assert( config.tandem.supplied, 'required tandems must be supplied' );
    }

    // The presence of `tandem` indicates if this PhetioObject can be initialized. If not yet initialized, perhaps
    // it will be initialized later on, as in Node.mutate().
    if ( !( PHET_IO_ENABLED && config.tandem && config.tandem.supplied ) ) {
      assert && !config.tandem && assert( !specifiesNonTandemPhetioObjectKey( config ), 'only specify metadata when providing a Tandem' );

      // In this case, the PhetioObject is not initialized, but still set tandem to maintain a consistent API for
      // creating the Tandem tree.
      if ( config.tandem ) {
        this.tandem = config.tandem;
      }
      return;
    }

    // assert this after the `specifiesPhetioObjectKey check to support something like:
    // `new Node( {tandem: tandem}).mutate({})`
    assert && assert( !this.phetioObjectInitialized, 'cannot initialize twice' );

    // Guard validation on assert to avoid calling a large number of no-ops when assertions are disabled, see https://github.com/phetsims/tandem/issues/200
    assert && validate( config.tandem, { valueType: Tandem } );

    config = merge( {}, DEFAULTS, baseOptions, config );

    // validate config before assigning to properties
    assert && validate( config.phetioType, IO_TYPE_VALIDATOR, 'phetioType must be an IOType' );
    assert && validate( config.phetioState, BOOLEAN_VALIDATOR, 'phetioState must be a boolean' );
    assert && validate( config.phetioReadOnly, BOOLEAN_VALIDATOR, 'phetioReadOnly must be a boolean' );
    assert && validate( config.phetioEventType, PHET_IO_EVENT_TYPE_VALIDATOR, 'invalid phetioEventType' );
    assert && validate( config.phetioDocumentation, PHET_IO_DOCUMENTATION_VALIDATOR, 'phetioDocumentation must be provided in the right format' );
    assert && validate( config.phetioHighFrequency, BOOLEAN_VALIDATOR, 'phetioHighFrequency must be a boolean' );
    assert && validate( config.phetioPlayback, BOOLEAN_VALIDATOR, 'phetioPlayback must be a boolean' );
    assert && validate( config.phetioStudioControl, BOOLEAN_VALIDATOR, 'phetioStudioControl must be a boolean' );
    assert && validate( config.phetioFeatured, BOOLEAN_VALIDATOR, 'phetioFeatured must be a boolean' );
    assert && validate( config.phetioEventMetadata, OBJECT_VALIDATOR, 'object literal expected' );
    assert && validate( config.phetioDynamicElement, BOOLEAN_VALIDATOR, 'phetioDynamicElement must be a boolean' );
    assert && validate( config.phetioDesigned, BOOLEAN_VALIDATOR, 'phetioDesigned must be a boolean' );

    assert && assert( this.linkedElements !== null, 'this means addLinkedElement was called before instrumentation of this PhetioObject' );

    // @public {boolean} optional - Indicates that an object is a archetype for a dynamic class. Settable only by
    // PhetioEngine and by classes that create dynamic elements when creating their archetype (like PhetioGroup) through
    // PhetioObject.markDynamicElementArchetype().
    // if true, items will be excluded from phetioState. This applies recursively automatically.
    this.phetioIsArchetype = false;

    // @public (phetioEngine) {Object|null}
    // Store the full baseline for usage in validation or for usage in studio.  Do this before applying overrides. The
    // baseline is created when a sim is run with assertions to assist in phetioAPIValidation.  However, even when
    // assertions are disabled, some wrappers such as studio need to generate the baseline anyway.
    // not all metadata are passed through via config, so store baseline for these additional properties
    this.phetioBaselineMetadata = ( phetioAPIValidation.enabled || phet.preloads.phetio.queryParameters.phetioEmitAPIBaseline ) ?
                                  this.getMetadata( merge( {
                                    phetioIsArchetype: this.phetioIsArchetype
                                  }, config ) ) :
                                  null;

    // Dynamic elements should compare to their "archetypal" counterparts.  For example, this means that a Particle
    // in a PhetioGroup will take its overrides from the PhetioGroup archetype.
    const archetypalPhetioID = config.tandem.getArchetypalPhetioID();

    // Overrides are only defined for simulations, not for unit tests.  See https://github.com/phetsims/phet-io/issues/1461
    // Patch in the desired values from overrides, if any.
    if ( window.phet.preloads.phetio.phetioElementsOverrides ) {
      const overrides = window.phet.preloads.phetio.phetioElementsOverrides[ archetypalPhetioID ];
      if ( overrides ) {

        // No need to make a new object, since this "config" variable was created in the previous merge call above.
        config = merge( config, overrides );
      }
    }

    // @public (read-only) {Tandem} - see docs at DEFAULTS declaration
    this.tandem = config.tandem;

    // @public (read-only) {IOType} - see docs at DEFAULTS declaration
    this._phetioType = config.phetioType;

    // @public (read-only) {boolean} - see docs at DEFAULTS declaration
    this._phetioState = config.phetioState;

    // @public (read-only) {boolean} - see docs at DEFAULTS declaration
    this._phetioReadOnly = config.phetioReadOnly;

    // @public (read-only) {string} - see docs at DEFAULTS declaration
    this._phetioDocumentation = config.phetioDocumentation;

    // @private {EventType} - see docs at DEFAULTS declaration
    this._phetioEventType = config.phetioEventType;

    // @private {boolean} - see docs at DEFAULTS declaration
    this._phetioHighFrequency = config.phetioHighFrequency;

    // @private {boolean} - see docs at DEFAULTS declaration
    this._phetioPlayback = config.phetioPlayback;

    // @private {boolean} - see docs at DEFAULTS declaration
    this._phetioStudioControl = config.phetioStudioControl;

    // @public (PhetioEngine) {boolean} - see docs at DEFAULTS declaration - in order to recursively pass this value to
    // children, the setPhetioDynamicElement() function must be used instead of setting this attribute directly
    this._phetioDynamicElement = config.phetioDynamicElement;

    // @public (read-only) {boolean} - see docs at DEFAULTS declaration
    this._phetioFeatured = config.phetioFeatured;

    // @private {Object|null}
    this._phetioEventMetadata = config.phetioEventMetadata;

    // @private {boolean}
    this._phetioDesigned = config.phetioDesigned;

    // @private {string|null} - for phetioDynamicElements, the corresponding phetioID for the element in the archetype subtree
    this.phetioArchetypePhetioID = null;

    // @private {LinkedElement[]|null} - keep track of LinkedElements for disposal. Null out to support asserting on
    // edge error cases, see this.addLinkedElement()
    this.linkedElements = [];

    // @public (phet-io) set to true when this PhetioObject has been sent over to the parent.
    this.phetioNotifiedObjectCreated = false;

    // @private {Array.<number>} - tracks the indices of started messages so that dataStream can check that ends match starts.
    this.phetioMessageStack = [];

    // Make sure playback shows in the phetioEventMetadata
    if ( this._phetioPlayback ) {
      this._phetioEventMetadata = this._phetioEventMetadata || {};
      assert && assert( !this._phetioEventMetadata.hasOwnProperty( 'playback' ), 'phetioEventMetadata.playback should not already exist' );
      this._phetioEventMetadata.playback = true;
    }

    // Alert that this PhetioObject is ready for cross-frame communication (thus becoming a "PhET-iO element" on the wrapper side.
    this.tandem.addPhetioObject( this );
    this.phetioObjectInitialized = true;
  }

  // @public - throws an assertion error in brands other than PhET-iO
  get phetioType() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioType only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioType;
  }

  // @public - throws an assertion error in brands other than PhET-iO
  get phetioState() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioState only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioState;
  }

  // @public - throws an assertion error in brands other than PhET-iO
  get phetioReadOnly() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioReadOnly only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioReadOnly;
  }

  // @public - throws an assertion error in brands other than PhET-iO
  get phetioDocumentation() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioDocumentation only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioDocumentation;
  }

  // @private - throws an assertion error in brands other than PhET-iO
  get phetioEventType() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioEventType only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioEventType;
  }

  // @private - throws an assertion error in brands other than PhET-iO
  get phetioHighFrequency() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioHighFrequency only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioHighFrequency;
  }

  // @private - throws an assertion error in brands other than PhET-iO
  get phetioPlayback() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioPlayback only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioPlayback;
  }

  // @private - throws an assertion error in brands other than PhET-iO
  get phetioStudioControl() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioStudioControl only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioStudioControl;
  }

  // @public - throws an assertion error in brands other than PhET-iO
  get phetioDynamicElement() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioDynamicElement only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioDynamicElement;
  }

  // @public - throws an assertion error in brands other than PhET-iO
  get phetioFeatured() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioFeatured only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioFeatured;
  }

  // @private - throws an assertion error in brands other than PhET-iO
  get phetioEventMetadata() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioEventMetadata only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioEventMetadata;
  }

  // @private - throws an assertion error in brands other than PhET-iO
  get phetioDesigned() {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioDesigned only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioDesigned;
  }

  /**
   * Start an event for the nested PhET-iO data stream.
   *
   * @param {string} event - the name of the event
   * @param {Object} [options]
   * @public
   */
  phetioStartEvent( event, options ) {
    if ( PHET_IO_ENABLED && this.isPhetioInstrumented() ) {

      // only one or the other can be provided
      assert && assertMutuallyExclusiveOptions( options, [ 'data' ], [ 'getData' ] );
      options = merge( {

        // {Object|null} - the data
        data: null,

        // {function():Object|null} - function that, when called get's the data.
        getData: null
      }, options );

      assert && assert( this.phetioObjectInitialized, 'phetioObject should be initialized' );
      assert && assert( typeof event === 'string' );
      assert && options.data && assert( typeof options.data === 'object' );
      assert && options.getData && assert( typeof options.getData === 'function' );
      assert && assert( arguments.length === 1 || arguments.length === 2, 'Prevent usage of incorrect signature' );

      // If you hit this, then it is likely related to https://github.com/phetsims/scenery/issues/1124 and we would like to know about it!
      assert && assert( phet.phetio.dataStream, 'trying to create an event before the data stream exists' );

      // Opt out of certain events if queryParameter override is provided. Even for a low frequency data stream, high
      // frequency events can still be emitted when they have a low frequency ancestor.
      const skipHighFrequencyEvent = this.phetioHighFrequency &&
                                     _.hasIn( window, 'phet.preloads.phetio.queryParameters' ) &&
                                     !window.phet.preloads.phetio.queryParameters.phetioEmitHighFrequencyEvents &&
                                     !phet.phetio.dataStream.isEmittingLowFrequencyEvent();

      if ( skipHighFrequencyEvent || this.phetioEventType === EventType.OPT_OUT ) {
        this.phetioMessageStack.push( SKIPPING_MESSAGE );
        return;
      }

      // Only get the args if we are actually going to send the event.
      const data = options.getData ? options.getData() : options.data;

      this.phetioMessageStack.push(
        phet.phetio.dataStream.start( this.phetioEventType, this.tandem.phetioID, this.phetioType, event, data, this.phetioEventMetadata, this.phetioHighFrequency )
      );

      // To support PhET-iO playback, any potential playback events downstream of this playback event must be marked as
      // non playback events. This is to prevent the PhET-iO playback engine from repeating those events. See
      // https://github.com/phetsims/phet-io/issues/1693
      this.phetioPlayback && phet.phetio.dataStream.pushNonPlaybackable();
    }
  }

  /**
   * End an event on the nested PhET-iO data stream. It this object was disposed or dataStream.start was not called,
   * this is a no-op.
   * @public
   */
  phetioEndEvent() {
    if ( PHET_IO_ENABLED && this.isPhetioInstrumented() ) {

      assert && assert( this.phetioMessageStack.length > 0, 'Must have messages to pop' );
      const topMessageIndex = this.phetioMessageStack.pop();

      // The message was started as a high frequency event to be skipped, so the end is a no-op
      if ( topMessageIndex === SKIPPING_MESSAGE ) {
        return;
      }
      this.phetioPlayback && phet.phetio.dataStream.popNonPlaybackable();
      phet.phetio.dataStream.end( topMessageIndex );
    }
  }

  /**
   * Set any instrumented descendants of this PhetioObject to the same value as this.phetioDynamicElement.
   * @private
   */
  propagateDynamicFlagsToDescendants() {
    assert && assert( Tandem.PHET_IO_ENABLED, 'phet-io should be enabled' );
    assert && assert( phet.phetio && phet.phetio.phetioEngine, 'Dynamic elements cannot be created statically before phetioEngine exists.' );
    const phetioEngine = phet.phetio.phetioEngine;

    // in the same order as bufferedPhetioObjects
    const unlaunchedPhetioIDs = !Tandem.launched ? Tandem.bufferedPhetioObjects.map( objectToPhetioID ) : [];

    this.tandem.iterateDescendants( tandem => {
      const phetioID = tandem.phetioID;

      if ( phetioEngine.hasPhetioObject( phetioID ) || ( !Tandem.launched && unlaunchedPhetioIDs.includes( phetioID ) ) ) {
        assert && assert( this.isPhetioInstrumented() );
        const phetioObject = phetioEngine.hasPhetioObject( phetioID ) ? phetioEngine.getPhetioObject( phetioID ) :
                             Tandem.bufferedPhetioObjects[ unlaunchedPhetioIDs.indexOf( phetioID ) ];

        assert && assert( phetioObject, 'should have a phetioObject here' );

        // Order matters here! The phetioIsArchetype needs to be first to ensure that the setPhetioDynamicElement
        // setter can opt out for archetypes.
        phetioObject.phetioIsArchetype = this.phetioIsArchetype;
        phetioObject.setPhetioDynamicElement( this.phetioDynamicElement );

        if ( phetioObject.phetioBaselineMetadata ) {
          phetioObject.phetioBaselineMetadata.phetioIsArchetype = this.phetioIsArchetype;
        }
      }
    } );
  }

  /**
   * @param {boolean} phetioDynamicElement
   * @public (PhetioEngine)
   */
  setPhetioDynamicElement( phetioDynamicElement ) {
    assert && assert( !this.phetioNotifiedObjectCreated, 'should not change dynamic element flags after notifying this PhetioObject\'s creation.' );
    assert && assert( this.isPhetioInstrumented() );

    // All archetypes are static (non-dynamic)
    this._phetioDynamicElement = this.phetioIsArchetype ? false : phetioDynamicElement;

    // For dynamic elements, indicate the corresponding archetype element so that clients like Studio can leverage
    // the archetype metadata. Static elements don't have archetypes.
    this.phetioArchetypePhetioID = phetioDynamicElement ? this.tandem.getArchetypalPhetioID() : null;

    // Keep the baseline metadata in sync.
    if ( this.phetioBaselineMetadata ) {
      this.phetioBaselineMetadata.phetioDynamicElement = this.phetioDynamicElement;
    }
  }

  /**
   * Mark this PhetioObject as an archetype for dynamic elements.
   * @public
   */
  markDynamicElementArchetype() {
    assert && assert( !this.phetioNotifiedObjectCreated, 'should not change dynamic element flags after notifying this PhetioObject\'s creation.' );

    this.phetioIsArchetype = true;
    this.setPhetioDynamicElement( false ); // because archetypes aren't dynamic elements

    if ( this.phetioBaselineMetadata ) {
      this.phetioBaselineMetadata.phetioIsArchetype = this.phetioIsArchetype;
    }

    // recompute for children also, but only if phet-io is enabled
    Tandem.PHET_IO_ENABLED && this.propagateDynamicFlagsToDescendants();
  }

  /**
   * A PhetioObject will only be instrumented if the tandem that was passed in was "supplied". See Tandem.supplied
   * for more info.
   * @returns {boolean}
   * @public
   */
  isPhetioInstrumented() {
    return this.tandem && this.tandem.supplied;
  }

  /**
   * When an instrumented PhetioObject is linked with another instrumented PhetioObject, this creates a one-way
   * association which is rendered in Studio as a "symbolic" link or hyperlink. Many common code UI elements use this
   * automatically. To keep client sites simple, this has a graceful opt-out mechanism which makes this function a
   * no-op if either this PhetioObject or the target PhetioObject is not instrumented.
   * @param {PhetioObject} element - the target element. Must be instrumented for a LinkedElement to be created--
   *                               - otherwise it gracefully opts out
   * @param {Object} [options]
   * @public
   */
  addLinkedElement( element, options ) {
    if ( !this.isPhetioInstrumented() ) {

      // set this to null so that you can't addLinkedElement on an uninitialized PhetioObject and then instrument
      // it afterwards.
      this.linkedElements = null;
      return;
    }

    assert && assert( element instanceof PhetioObject, 'element must be of type PhetioObject' );

    // In some cases, UI components need to be wired up to a private (internal) Property which should neither be
    // instrumented nor linked.
    if ( PHET_IO_ENABLED && element.isPhetioInstrumented() ) {
      assert && assert( Array.isArray( this.linkedElements ), 'linkedElements should be an array' );
      this.linkedElements.push( new LinkedElement( element, options ) );
    }
  }

  /**
   * Remove all linked elements linking to the provided PhetioObject. This will dispose all removed LinkedElements. This
   * will be graceful, and doesn't assume or assert that the provided PhetioObject has LinkedElement(s), it will just
   * remove them if they are there.
   * @param {PhetioObject} potentiallyLinkedElement
   * @public
   */
  removeLinkedElements( potentiallyLinkedElement ) {
    if ( this.isPhetioInstrumented() && this.linkedElements ) {
      assert && assert( potentiallyLinkedElement instanceof PhetioObject );
      assert && assert( potentiallyLinkedElement.isPhetioInstrumented() );

      const toRemove = this.linkedElements.filter( linkedElement => linkedElement.element === potentiallyLinkedElement );
      toRemove.forEach( linkedElement => {
        linkedElement.dispose();
        arrayRemove( this.linkedElements, linkedElement );
      } );
    }
  }

  /**
   * Performs cleanup after the sim's construction has finished.
   *
   * @public
   */
  onSimulationConstructionCompleted() {

    // deletes the phetioBaselineMetadata, as it's no longer needed since validation is complete.
    this.phetioBaselineMetadata = null;
  }

  /**
   * Remove this phetioObject from PhET-iO. After disposal, this object is no longer interoperable. Also release any
   * other references created during its lifetime.
   * @public
   */
  dispose() {
    assert && assert( !this.isDisposed, 'PhetioObject can only be disposed once' );

    const descendants = [];
    if ( Tandem.PHET_IO_ENABLED && this.tandem.supplied ) {
      const phetioEngine = phet.phetio.phetioEngine;
      this.tandem.iterateDescendants( tandem => {
        if ( phetioEngine.hasPhetioObject( tandem.phetioID ) ) {
          descendants.push( phetioEngine.getPhetioObject( tandem.phetioID ) );
        }
      } );
    }

    // In order to support the structured data stream, PhetioObjects must end the messages in the correct
    // sequence, without being interrupted by dispose() calls.  Therefore, we do not clear out any of the state
    // related to the endEvent.  Note this means it is acceptable (and expected) for endEvent() to be called on
    // disposed PhetioObjects.
    //
    // The phetioEvent stack should resolve by the next frame, so that's when we check it.
    assert && animationFrameTimer.runOnNextTick( () => {

      // Uninstrumented PhetioObjects don't have a phetioMessageStack attribute.
      assert && assert( !this.hasOwnProperty( 'phetioMessageStack' ) || this.phetioMessageStack.length === 0,
        'phetioMessageStack should be clear' );

      descendants.forEach( descendant => {
        assert && assert( descendant.isDisposed, `All descendants must be disposed by the next frame: ${descendant.tandem.phetioID}` );
      } );
    } );

    if ( this.phetioObjectInitialized ) {
      this.tandem.removePhetioObject( this );
    }

    // Dispose LinkedElements
    if ( this.linkedElements ) {
      this.linkedElements.forEach( linkedElement => linkedElement.dispose() );
      this.linkedElements.length = 0;
    }

    this.isDisposed = true;
  }

  /**
   * JSONifiable metadata that describes the nature of the PhetioObject.  We must be able to read this
   * for baseline (before object fully constructed we use object) and after fully constructed
   * which includes overrides.
   * @param {Object} [object] - used to get metadata keys, can be a PhetioObject, or an options object
   *                          (see usage initializePhetioObject). If not provided, will instead use the value of "this"
   * @returns {Object} - metadata plucked from the passed in parameter
   * @public
   */
  getMetadata( object ) {
    object = object || this;
    const metadata = {
      phetioTypeName: object.phetioType.typeName,
      phetioDocumentation: object.phetioDocumentation,
      phetioState: object.phetioState,
      phetioReadOnly: object.phetioReadOnly,
      phetioEventType: EventType.phetioType.toStateObject( object.phetioEventType ),
      phetioHighFrequency: object.phetioHighFrequency,
      phetioPlayback: object.phetioPlayback,
      phetioStudioControl: object.phetioStudioControl,
      phetioDynamicElement: object.phetioDynamicElement,
      phetioIsArchetype: object.phetioIsArchetype,
      phetioFeatured: object.phetioFeatured,
      phetioDesigned: object.phetioDesigned
    };
    if ( object.phetioArchetypePhetioID ) {
      metadata.phetioArchetypePhetioID = object.phetioArchetypePhetioID;
    }
    return metadata;
  }
}

// @public
PhetioObject.DEFAULT_OPTIONS = DEFAULTS; // the default options for the phet-io object

/**
 * Determine if any of the options keys are intended for PhetioObject. Semantically equivalent to
 * _.intersection( _.keys( options ), _.keys( DEFAULTS) ).length>0 but implemented imperatively to avoid memory or
 * performance issues. Also handles options.tandem differently.
 * @param {Object} [options]
 * @returns {boolean}
 */
const specifiesNonTandemPhetioObjectKey = options => {
  for ( const key in options ) {
    if ( key !== 'tandem' && options.hasOwnProperty( key ) && DEFAULTS.hasOwnProperty( key ) ) {
      return true;
    }
  }
  return false;
};

// Since PhetioObject is extended with inherit (e.g., SCENERY/Node), this cannot be an ES6 class
/**
 * Internal class to avoid cyclic dependencies.
 * @private
 */
class LinkedElement extends PhetioObject {

  /**
   * @param {PhetioObject} coreElement
   * @param {Object} [options]
   */
  constructor( coreElement, options ) {
    assert && assert( !!coreElement, 'coreElement should be defined' );
    assert && assert( coreElement instanceof PhetioObject, 'coreElement should be PhetioObject' );
    assert && assert( coreElement.tandem, 'coreElement should have a tandem' );

    options = merge( {
      phetioType: LinkedElementIO
    }, options );

    // References cannot be changed by PhET-iO
    assert && assert( !options.hasOwnProperty( 'phetioReadOnly' ), 'phetioReadOnly set by LinkedElement' );
    options.phetioReadOnly = true;

    // By default, this linked element's baseline value is the overridden value of the coreElement. This allows
    // the them to be in sync by default, but also allows the linked element to be overridden in studio.
    assert && assert( !options.hasOwnProperty( 'phetioFeatured' ), 'phetioFeatured set by LinkedElement' );
    options.phetioFeatured = coreElement.phetioFeatured;

    super( options );

    // @public (read-only)
    this.element = coreElement;
  }

  /**
   * LinkedElements listen to their core elements for phetioFeatured, so to avoid a dependency on overrides metadata
   * (when the core element's phetioFeatured is specified in the overrides file), ignore phetioFeatured for LinkedElements.
   * @override
   * @param {Object} object - used to get metadata keys, can be a PhetioObject, or an options object
   *                          (see usage initializePhetioObject)
   * @returns {Object} - metadata plucked from the passed in parameter
   * @public
   */
  getMetadata( object ) {
    const phetioObjectMetadata = super.getMetadata( object );
    delete phetioObjectMetadata.phetioFeatured;
    return phetioObjectMetadata;
  }
}

tandemNamespace.register( 'PhetioObject', PhetioObject );
export default PhetioObject;