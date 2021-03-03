//Remove this block in production
import dotenv = require('dotenv');
dotenv.config();

// Start the server
import { startServer } from './tools/startServer';
startServer(3350);