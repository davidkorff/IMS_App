const dataAccess = require('./dataAccess');

class RatingTypeService {
    /**
     * Get all available rating types from IMS
     * @param {Object} instanceConfig - IMS instance configuration
     * @returns {Array} List of rating types
     */
    async getRatingTypes(instanceConfig) {
        try {
            const result = await dataAccess.executeProc({
                url: instanceConfig.url,
                username: instanceConfig.username,
                password: instanceConfig.password,
                procedure: 'DK_GetRatingTypes',  // DataAccess will handle the _WS suffix
                parameters: {}
            });

            // The result should contain a Table property with the rating types
            if (result && result.Table) {
                // Ensure it's always an array
                return Array.isArray(result.Table) ? result.Table : [result.Table];
            }

            return [];
        } catch (error) {
            console.error('Error fetching rating types:', error);
            throw new Error('Failed to fetch rating types from IMS');
        }
    }

    /**
     * Get a specific rating type by ID
     * @param {Object} instanceConfig - IMS instance configuration
     * @param {number} ratingTypeId - The rating type ID
     * @returns {Object|null} Rating type details or null if not found
     */
    async getRatingTypeById(instanceConfig, ratingTypeId) {
        try {
            const ratingTypes = await this.getRatingTypes(instanceConfig);
            return ratingTypes.find(rt => rt.RatingTypeID === ratingTypeId) || null;
        } catch (error) {
            console.error('Error fetching rating type by ID:', error);
            return null;
        }
    }
}

module.exports = new RatingTypeService();