// Copyright 2019-2021, University of Colorado Boulder

/**
 * Supertype for containers that hold dynamic elements that are PhET-iO instrumented. This type handles common
 * features like creating the archetype for the PhET-iO API, and managing created/disposed data stream events.
 *
 * "Dynamic" is an overloaded term, so allow me to explain what it means in the context of this type. A "dynamic element"
 * is an instrumented PhET-iO element that is conditionally in the PhET-iO API. Most commonly this is because elements
 * can be created and destroyed during the runtime of the sim. Another "dynamic element" for the PhET-iO project is when
 * an element may or may not be created based on a query parameter. In this case, even if the object then exists for the
 * lifetime of the sim, we may still call this "dynamic" as it pertains to this type, and the PhET-iO API.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Emitter from '../../axon/js/Emitter.js';
import validate from '../../axon/js/validate.js';
import arrayRemove from '../../phet-core/js/arrayRemove.js';
import merge from '../../phet-core/js/merge.js';
import DynamicTandem from './DynamicTandem.js';
import PhetioObject from './PhetioObject.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import IOType from './types/IOType.js';

// constants
const DEFAULT_CONTAINER_SUFFIX = 'Container';

class PhetioDynamicElementContainer extends PhetioObject {

  /**
   * @param {function(Tandem,...args):PhetioObject} createElement - function that creates a dynamic element to be housed in
   * this container. All of this dynamic element container's elements will be created from this function, including the
   * archetype.
   * @param {Array.<*>|function():Array.<*>} defaultArguments - arguments passed to createElement when creating the archetype
   * @param {Object} [options] - describe the Group itself
   */
  constructor( createElement, defaultArguments, options ) {

    options = merge( {
      phetioState: false, // elements are included in state, but the container will exist in the downstream sim.
      tandem: Tandem.REQUIRED,

      // By default, a PhetioDynamicElementContainer's elements are included in state such that on every setState call,
      // the elements are cleared out by the phetioStateEngine so elements in the state can be added to the empty group.
      // This option is for opting out of that behavior. When false, this container will not have its elements cleared
      // when beginning to set PhET-iO state. Furthermore, view elements following the "only the models are stateful"
      // pattern must mark this as false, otherwise the state engine will try to create these elements instead of letting
      // the model notifications handle this.
      supportsDynamicState: true,

      // {string} The container's tandem name must have this suffix, and the base tandem name for elements in
      // the container will consist of the group's tandem name with this suffix stripped off.
      containerSuffix: DEFAULT_CONTAINER_SUFFIX
    }, options );

    assert && assert( typeof createElement === 'function', 'createElement should be a function' );
    assert && assert( Array.isArray( defaultArguments ) || typeof defaultArguments === 'function', 'defaultArguments should be an array or a function' );
    if ( Array.isArray( defaultArguments ) ) {

      // createElement expects a Tandem as the first arg
      assert && assert( createElement.length === defaultArguments.length + 1, 'mismatched number of arguments' );
    }

    assert && Tandem.VALIDATION && assert( !!options.phetioType, 'phetioType must be supplied' );
    assert && Tandem.VALIDATION && assert( Array.isArray( options.phetioType.parameterTypes ), 'phetioType must supply its parameter types' );
    assert && Tandem.VALIDATION && assert( options.phetioType.parameterTypes.length === 1,
      'PhetioDynamicElementContainer\'s phetioType must have exactly one parameter type' );
    assert && Tandem.VALIDATION && assert( !!options.phetioType.parameterTypes[ 0 ],
      'PhetioDynamicElementContainer\'s phetioType\'s parameterType must be truthy' );
    assert && Tandem.VALIDATION && assert( options.tandem.name.endsWith( options.containerSuffix ),
      'PhetioDynamicElementContainer tandems should end with options.containerSuffix' );

    // options that depend on other options
    options = merge( {

      // {string} - tandem name for elements in the container is the container's tandem name without containerSuffix
      phetioDynamicElementName: options.tandem.name.slice( 0, options.tandem.name.length - options.containerSuffix.length )
    }, options );

    super( options );

    // @public (read-only phet-io internal) {boolean}
    this.supportsDynamicState = options.supportsDynamicState;

    // @protected {string}
    this.phetioDynamicElementName = options.phetioDynamicElementName;

    // @protected
    this.createElement = createElement;
    this.defaultArguments = defaultArguments;

    // @public (read-only) {PhetioObject|null} Can be used as an argument to create other archetypes, but otherwise
    // access should not be needed. This will only be non-null when generating the PhET-iO API, see createArchetype().
    this.archetype = this.createArchetype();

    // @public (read-only) - subtypes expected to fire this according to individual implementations
    this.elementCreatedEmitter = new Emitter( { parameters: [ { valueType: PhetioObject } ] } );

    // @public (read-only) - called on disposal of an element
    this.elementDisposedEmitter = new Emitter( { parameters: [ { valueType: PhetioObject } ] } );

    // Emit to the data stream on element creation/disposal, no need to do this in PhET brand
    if ( Tandem.PHET_IO_ENABLED ) {
      this.elementCreatedEmitter.addListener( element => this.createdEventListener( element ) );
      this.elementDisposedEmitter.addListener( element => this.disposedEventListener( element ) );
    }

    // @private {boolean} - a way to delay creation notifications to a later time, for phet-io state engine support
    this.notificationsDeferred = false;

    // @private {PhetioObject} - lists to keep track of the created and disposed elements when notifications are deferred.
    // These are used to then flush notifications when they are set to no longer be deferred.
    this.deferredCreations = [];
    this.deferredDisposals = [];

    // provide a way to opt out of containers clearing dynamic state, useful if group elements exist for the lifetime of
    // the sim, see https://github.com/phetsims/tandem/issues/132
    if ( Tandem.PHET_IO_ENABLED && this.supportsDynamicState &&

         // don't clear archetypes because they are static.
         !this.phetioIsArchetype ) {

      assert && assert( _.hasIn( window, 'phet.phetio.phetioEngine.phetioStateEngine' ),
        'PhetioDynamicElementContainers must be created once phetioEngine has been constructed' );

      const phetioStateEngine = phet.phetio.phetioEngine.phetioStateEngine;

      // On state start, clear out the container and set to defer notifications.
      phetioStateEngine.onBeforeStateSetEmitter.addListener( ( state, scopeTandem ) => {

        // Only clear if this PhetioDynamicElementContainer is in scope of the state to be set
        if ( this.tandem.hasAncestor( scopeTandem ) ) {
          this.clear( { fromStateSetting: true } );
          this.setNotificationsDeferred( true );
        }
      } );

      // done with state setting
      phetioStateEngine.stateSetEmitter.addListener( () => {
        if ( this.notificationsDeferred ) {
          this.setNotificationsDeferred( false );
        }
      } );

      phetioStateEngine.addSetStateHelper( ( state, stillToSetIDs ) => {
        let creationNotified = false;

        while ( this.deferredCreations.length > 0 ) {
          const deferredCreatedElement = this.deferredCreations[ 0 ];
          if ( this.stateSetOnAllChildrenOfDynamicElement( deferredCreatedElement.tandem.phetioID, stillToSetIDs ) ) {
            this.notifyElementCreatedWhileDeferred( deferredCreatedElement );
            creationNotified = true;
          }
        }
        return creationNotified;
      } );
    }
  }

  /**
   * @param {string} dynamicElementID
   * @param {string[]} stillToSetIDs
   * @returns {boolean} - true if all children of a single dynamic element (based on phetioID) have had their state set already.
   * @private
   */
  stateSetOnAllChildrenOfDynamicElement( dynamicElementID, stillToSetIDs ) {
    for ( let i = 0; i < stillToSetIDs.length; i++ ) {
      if ( phetio.PhetioIDUtils.isAncestor( dynamicElementID, stillToSetIDs[ i ] ) ) {
        return false;
      }
    }
    return true; // No elements in state that aren't in the completed list
  }

  /**
   * Archetypes are created to generate the baseline file, or to validate against an existing baseline file.  They are
   * PhetioObjects and registered with the phetioEngine, but not send out via notifications from PhetioEngine.phetioElementAddedEmitter(),
   * because they are intended for internal usage only.  Archetypes should not be created in production code.
   * @returns {null|PhetioObject}
   * @private
   */
  createArchetype() {

    // Once the sim has started, any archetypes being created are likely done so because they are nested PhetioGroups.
    if ( _.hasIn( window, 'phet.joist.sim' ) && phet.joist.sim.isConstructionCompleteProperty.value ) {
      return null;
    }

    // When generating the baseline, output the schema for the archetype
    if ( Tandem.PHET_IO_ENABLED && phet.preloads.phetio.createArchetypes ) {
      const defaultArgs = Array.isArray( this.defaultArguments ) ? this.defaultArguments : this.defaultArguments();

      // The create function takes a tandem plus the default args
      assert && assert( this.createElement.length === defaultArgs.length + 1, 'mismatched number of arguments' );

      const archetype = this.createElement( this.tandem.createTandem( DynamicTandem.DYNAMIC_ARCHETYPE_NAME ), ...defaultArgs );

      // Mark the archetype for inclusion in the baseline schema
      archetype.markDynamicElementArchetype();
      return archetype;
    }
    else {
      return null;
    }
  }

  /**
   * Create a dynamic PhetioObject element for this container
   * @param {string} componentName
   * @param {Array.<*>} argsForCreateFunction
   * @param {IOType|null} containerParameterType - null in PhET brand
   * @returns {PhetioObject}
   * @public
   */
  createDynamicElement( componentName, argsForCreateFunction, containerParameterType ) {
    assert && assert( Array.isArray( argsForCreateFunction ), 'should be array' );

    // create with default state and substructure, details will need to be set by setter methods.

    let createdObjectTandem;
    if ( !this.tandem.hasChild( componentName ) ) {
      createdObjectTandem = new DynamicTandem( this.tandem, componentName, this.tandem.getExtendedOptions() );
    }
    else {
      createdObjectTandem = this.tandem.createTandem( componentName, this.tandem.getExtendedOptions() );
      assert && assert( createdObjectTandem instanceof DynamicTandem, 'createdObjectTandem should be an instance of DynamicTandem' );
    }

    const createdObject = this.createElement( createdObjectTandem, ...argsForCreateFunction );

    // This validation is only needed for PhET-iO brand
    if ( Tandem.PHET_IO_ENABLED ) {
      assert && assert( containerParameterType instanceof IOType, 'containerParameterType must be provided in PhET-iO brand' );

      // Make sure the new group element matches the schema for elements.
      validate( createdObject, containerParameterType.validator );

      assert && assert( createdObject.phetioType === containerParameterType,
        'dynamic element container expected its created instance\'s phetioType to match its parameterType.' );
    }

    assert && this.assertDynamicPhetioObject( createdObject );

    return createdObject;
  }

  /**
   * A dynamic element should be an instrumented PhetioObject with phetioDynamicElement: true
   * @param {PhetioObject} phetioObject - object to be validated
   * @private
   */
  assertDynamicPhetioObject( phetioObject ) {
    if ( Tandem.PHET_IO_ENABLED && Tandem.VALIDATION ) {
      assert && assert( phetioObject instanceof PhetioObject, 'instance should be a PhetioObject' );
      assert && assert( phetioObject.isPhetioInstrumented(), 'instance should be instrumented' );
      assert && assert( phetioObject.phetioDynamicElement, 'instance should be marked as phetioDynamicElement:true' );
    }
  }

  /**
   * Emit a created or disposed event.
   * @param {PhetioObject} dynamicElement
   * @param {string} eventName
   * @param {Object} [additionalData] additional data for the event
   * @private
   */
  emitDataStreamEvent( dynamicElement, eventName, additionalData ) {
    this.phetioStartEvent( eventName, {
      data: merge( {
        phetioID: dynamicElement.tandem.phetioID
      }, additionalData )
    } );
    this.phetioEndEvent();
  }

  /**
   * Emit events when dynamic elements are created.
   * @param {PhetioObject} dynamicElement
   * @private
   */
  createdEventListener( dynamicElement ) {
    const additionalData = dynamicElement.phetioState ? {
      state: this.phetioType.parameterTypes[ 0 ].toStateObject( dynamicElement )
    } : null;
    this.emitDataStreamEvent( dynamicElement, 'created', additionalData );
  }

  /**
   * Emit events when dynamic elements are disposed.
   * @param {PhetioObject} dynamicElement
   * @private
   */
  disposedEventListener( dynamicElement ) {
    this.emitDataStreamEvent( dynamicElement, 'disposed' );
  }

  /**
   * @public
   */
  dispose() {

    // If hitting this assertion because of nested dynamic element containers, please discuss with a phet-io team member.
    assert && assert( false, 'PhetioDynamicElementContainers are not intended for disposal' );
  }

  /**
   * Dispose a contained element
   * @param {PhetioObject} element
   * @param {boolean} [fromStateSetting] - Used for validation during state setting. This should only be true when this
   * function is being called from setting PhET-iO state in PhetioStateEngine.js. This flag is used purely for validation.
   * If this function is called during PhET-iO state setting, but not from the state engine, then it is from sim-specific,
   * non-PhET-iO code, and will most likely be buggy. As an example let's think about this in terms of PhetioGroup. If
   * the state to be set has {3} elements, and sets modelProperty to be `X`, then that is because the upstream sim is in
   * that state. If modelProperty's listener responds to the setting of it by deleting an element (in the downstream sim),
   * then this flag will throw an error, because it would yield only {2} elements in the downstream sim after state set.
   * The solution to this error would be to guard modelProperty's listener by making sure it only deletes an element when
   * the listener is changed because of a force that isn't the PhET-iO state engine (see Sim.isSettingPhetioStateProperty
   * and its usages). This helps catch complicated and obfuscated state bugs in an easy way. After reading this, it
   * should go without saying that sim code should NOT set this flag to be true!
   * @protected - should not be called directly for PhetioGroup or PhetioCapsule, but can be made public if other subtypes need to.
   */
  disposeElement( element, fromStateSetting ) {
    element.dispose();

    assert && this.supportsDynamicState && _.hasIn( window, 'phet.joist.sim' ) &&
    phet.joist.sim.isSettingPhetioStateProperty.value && assert( fromStateSetting,
      'should not dispose a dynamic element while setting phet-io state' );

    if ( this.notificationsDeferred ) {
      this.deferredDisposals.push( element );
    }
    else {
      this.elementDisposedEmitter.emit( element );
    }
  }

  /**
   * @public
   * @abstract
   * @param {Object} [options]
   * @param {boolean} options.fromStateSetting -  Used for validation during state setting. See this.disposeElement() for documentation
   */
  clear( options ) {
    throw new Error( 'clear() is abstract and should be implemented by subtypes' );
  }

  /**
   * Flush a single element from the list of deferred disposals that have not yet notified about the disposal. This
   * should never be called publicly, instead see `disposeElement`
   * @private
   * @param {PhetioObject} disposedElement
   */
  notifyElementDisposedWhileDeferred( disposedElement ) {
    assert && assert( this.notificationsDeferred, 'should only be called when notifications are deferred' );
    assert && assert( this.deferredDisposals.indexOf( disposedElement ) >= 0, 'disposedElement should not have been already notified' );
    this.elementDisposedEmitter.emit( disposedElement );
    arrayRemove( this.deferredDisposals, disposedElement );
  }

  /**
   * Should be called by subtypes upon element creation, see PhetioGroup as an example.
   * @protected
   * @param {PhetioObject} createdElement
   */
  notifyElementCreated( createdElement ) {
    if ( this.notificationsDeferred ) {
      this.deferredCreations.push( createdElement );
    }
    else {
      this.elementCreatedEmitter.emit( createdElement );
    }
  }

  /**
   * Flush a single element from the list of deferred creations that have not yet notified about the disposal. This
   * is only public to support specific order dependencies in the PhetioStateEngine, otherwise see `this.notifyElementCreated()`
   * @public (PhetioGroupTests, phet-io) - only the PhetioStateEngine should notify individual elements created.
   * @param {PhetioObject} createdElement
   */
  notifyElementCreatedWhileDeferred( createdElement ) {
    assert && assert( this.notificationsDeferred, 'should only be called when notifications are deferred' );
    assert && assert( this.deferredCreations.indexOf( createdElement ) >= 0, 'createdElement should not have been already notified' );
    this.elementCreatedEmitter.emit( createdElement );
    arrayRemove( this.deferredCreations, createdElement );
  }

  /**
   * When set to true, creation and disposal notifications will be deferred until set to false. When set to false,
   * this function will flush all of the notifications for created and disposed elements (in that order) that occurred
   * while this container was deferring its notifications.
   * @public
   * @param {boolean} notificationsDeferred
   */
  setNotificationsDeferred( notificationsDeferred ) {
    assert && assert( notificationsDeferred !== this.notificationsDeferred, 'should not be the same as current value' );

    // Flush all notifications when setting to be no longer deferred
    if ( !notificationsDeferred ) {
      while ( this.deferredCreations.length > 0 ) {
        this.notifyElementCreatedWhileDeferred( this.deferredCreations[ 0 ] );
      }
      while ( this.deferredDisposals.length > 0 ) {
        this.notifyElementDisposedWhileDeferred( this.deferredDisposals[ 0 ] );
      }
    }
    assert && assert( this.deferredCreations.length === 0, 'creations should be clear' );
    assert && assert( this.deferredDisposals.length === 0, 'disposals should be clear' );
    this.notificationsDeferred = notificationsDeferred;
  }

  /**
   * @public - add the phetioDynamicElementName for API tracking
   * @param {Object} [object]
   * @override
   */
  getMetadata( object ) {
    const metadata = super.getMetadata( object );
    assert && assert(
      !metadata.hasOwnProperty( 'phetioDynamicElementName' ),
      'PhetioDynamicElementContainer sets the phetioDynamicElementName metadata key'
    );
    return merge( { phetioDynamicElementName: this.phetioDynamicElementName }, metadata );
  }
}

tandemNamespace.register( 'PhetioDynamicElementContainer', PhetioDynamicElementContainer );
export default PhetioDynamicElementContainer;