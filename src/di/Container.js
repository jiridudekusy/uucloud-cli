/**
 * Dependency Injection Container
 */
class Container {
  /**
   * Create a new container instance
   */
  constructor() {
    this._services = new Map();
    this._factories = new Map();
    this._serviceImplementations = new Map();
  }
  
  /**
   * Register a service instance
   * @param {string} name - Service name
   * @param {Object} instance - Service instance
   * @returns {Container} - The container instance for chaining
   */
  register(name, instance) {
    this._services.set(name, instance);
    return this;
  }
  
  /**
   * Register a factory function to create service instances
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @returns {Container} - The container instance for chaining
   */
  registerFactory(name, factory) {
    this._factories.set(name, factory);
    return this;
  }
  
  /**
   * Register a service with its interface and implementation factory
   * @param {string} interfaceName - Interface name
   * @param {Class} interfaceClass - Interface class
   * @param {Function} implementationFactory - Factory function to create implementation instances
   * @returns {Container} - The container instance for chaining
   */
  registerService(interfaceName, interfaceClass, implementationFactory) {
    this._serviceImplementations.set(interfaceName, {
      interface: interfaceClass,
      factory: implementationFactory
    });
    return this;
  }
  
  /**
   * Get a service instance
   * @param {string} name - Service name
   * @returns {Object} - Service instance
   * @throws {Error} - If service not found
   */
  get(name) {
    if (this._services.has(name)) {
      return this._services.get(name);
    }
    if (this._factories.has(name)) {
      return this._factories.get(name)();
    }
    throw new Error(`Service not found: ${name}`);
  }
  
  /**
   * Get an implementation factory for a specific interface
   * @param {string} interfaceName - Interface name
   * @returns {Function} - Factory function that creates implementation instances
   * @throws {Error} - If implementation not found
   */
  getImplementationFactory(interfaceName) {
    if (this._serviceImplementations.has(interfaceName)) {
      return this._serviceImplementations.get(interfaceName).factory;
    }
    throw new Error(`Implementation for ${interfaceName} not found`);
  }
  
  /**
   * Create a command instance with dependencies injected
   * @param {Function} CommandClass - Command class constructor
   * @returns {Object} - Command instance
   */
  createCommand(CommandClass) {
    return new CommandClass({
      tokenProvider: this.get('tokenProvider'),
      clientFactory: (interfaceType, token, opts) => {
        const factory = this.getImplementationFactory(interfaceType);
        return factory(token, opts);
      },
      console: this.get('console'),
      fileSystem: this.has('fileSystem') ? this.get('fileSystem') : null
    });
  }
  
  /**
   * Check if a service exists
   * @param {string} name - Service name
   * @returns {boolean} - True if service exists
   */
  has(name) {
    return this._services.has(name) || this._factories.has(name);
  }
  
  /**
   * Check if an implementation for an interface exists
   * @param {string} interfaceName - Interface name
   * @returns {boolean} - True if implementation exists
   */
  hasImplementation(interfaceName) {
    return this._serviceImplementations.has(interfaceName);
  }
}

module.exports = Container; 