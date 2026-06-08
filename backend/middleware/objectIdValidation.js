const mongoose = require('mongoose');

const validateObjectId = (paramName) => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!id) return next();
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                message: `Invalid ${paramName} format`,
                code: 'INVALID_ID'
            });
        }
        next();
    };
};

const validateObjectIdMiddleware = (paramNames) => {
    return (req, res, next) => {
        for (const paramName of paramNames) {
            const id = req.params[paramName];
            if (id && !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ 
                    message: `Invalid ${paramName} format`,
                    code: 'INVALID_ID'
                });
            }
        }
        next();
    };
};

module.exports = {
    validateObjectId,
    validateObjectIdMiddleware
};
