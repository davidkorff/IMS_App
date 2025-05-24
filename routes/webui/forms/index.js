const producersRouter = require('./producers');
const underwritersRouter = require('./underwriters');

router.use('/producers', producersRouter);
router.use('/underwriters', underwritersRouter);

module.exports = router; 