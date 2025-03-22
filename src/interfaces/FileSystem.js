/**
 * Interface for file system operations
 */
class FileSystem {
  /**
   * Read a file from the file system
   * @param {string} path - Path to the file
   * @returns {Promise<string>} - Content of the file
   */
  async readFile(path) { 
    throw new Error("Method readFile not implemented");
  }

  /**
   * Write content to a file
   * @param {string} path - Path to the file
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  async writeFile(path, content) {
    throw new Error("Method writeFile not implemented");
  }

  /**
   * Check if a file exists
   * @param {string} path - Path to the file
   * @returns {Promise<boolean>} - True if file exists
   */
  async exists(path) {
    throw new Error("Method exists not implemented");
  }

  /**
   * Create a directory
   * @param {string} path - Path to the directory
   * @returns {Promise<void>}
   */
  async mkdir(path) {
    throw new Error("Method mkdir not implemented");
  }
}

module.exports = FileSystem; 