const prompts = require('@inquirer/prompts');

/**
 * Display a searchable prompt to select from a list of options
 * 
 * @param {string} question - The prompt question
 * @param {Array<{name: string, value: any}>} options - Options to select from
 * @returns {Promise<any>} - The selected value
 */
async function searchPrompt(question, options) {
  const rows = process.stdout.rows;
  const answer = await prompts.search({
    message: question,
    pageSize: rows - 2,
    source: async (input) => {
      return options.filter(option => {
        let terms = (input || "").split(" ");
        return terms.every(term => option.name.toLowerCase().includes(term.toLowerCase()));
      });
    },
  });

  return answer;
}

module.exports = {
  searchPrompt
};