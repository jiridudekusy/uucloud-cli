const FileSystem = require('../interfaces/FileSystem');
const fs = require('fs');
const { promisify } = require('util');
const mkdirp = require('mkdirp');

/**
 * Real implementation of FileSystem using Node.js fs module
 */
class RealFileSystem extends FileSystem {
  /**
   * Read a file from the file system
   * @param {string} path - Path to the file
   * @returns {Promise<string>} - Content of the file
   */
  async readFile(path) {
    return promisify(fs.readFile)(path, 'utf8');
  }

  /**
   * Write content to a file
   * @param {string} path - Path to the file
   * @param {string} content - Content to write
   * @returns {Promise<void>}
   */
  async writeFile(path, content) {
    return promisify(fs.writeFile)(path, content, 'utf8');
  }

  /**
   * Check if a file exists
   * @param {string} path - Path to the file
   * @returns {Promise<boolean>} - True if file exists
   */
  async exists(path) {
    try {
      await promisify(fs.access)(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a directory
   * @param {string} path - Path to the directory
   * @returns {Promise<void>}
   */
  async mkdir(path) {
    return mkdirp(path);
  }
}

module.exports = RealFileSystem; 