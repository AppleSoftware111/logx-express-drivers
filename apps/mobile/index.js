import { registerRootComponent } from 'expo';

// Register the background GPS task before the app tree mounts.
import './src/services/gpsService';

import App from './App';

registerRootComponent(App);
