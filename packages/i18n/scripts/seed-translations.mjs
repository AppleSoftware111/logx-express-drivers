import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');

const es = {
  common: {
    save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', add: 'Añadir',
    create: 'Crear', update: 'Actualizar', close: 'Cerrar', search: 'Buscar', filter: 'Filtrar',
    loading: 'Cargando...', retry: 'Reintentar', yes: 'Sí', no: 'No', actions: 'Acciones',
    status: 'Estado', name: 'Nombre', email: 'Correo', phone: 'Teléfono', address: 'Dirección',
    date: 'Fecha', time: 'Hora', noResults: 'No se encontraron resultados',
    errorGeneric: 'Algo salió mal. Inténtelo de nuevo.',
    confirmDelete: '¿Seguro que desea eliminar?',
    successSaved: 'Guardado correctamente', successDeleted: 'Eliminado correctamente',
    back: 'Volver', next: 'Siguiente', previous: 'Anterior', view: 'Ver',
    export: 'Exportar', download: 'Descargar', active: 'Activo', inactive: 'Inactivo', all: 'Todos',
    language: 'Idioma',
  },
  auth: {
    login: 'Iniciar sesión', logout: 'Cerrar sesión', email: 'Correo', password: 'Contraseña',
    signIn: 'Iniciar sesión', signInTitle: 'Iniciar sesión en LOGX Express',
    signInSubtitle: 'Plataforma logística para hospitales y laboratorios',
    sessionExpired: 'Su sesión expiró. Inicie sesión de nuevo.',
    invalidCredentials: 'Correo o contraseña inválidos',
    enterEmailPassword: 'Ingrese correo y contraseña',
    driverApp: 'App del conductor', changePassword: 'Cambiar contraseña',
    currentPassword: 'Contraseña actual', newPassword: 'Nueva contraseña', confirmPassword: 'Confirmar contraseña',
  },
  nav: {
    dashboard: 'Panel', operations: 'Operaciones', routes: 'Rutas', executions: 'Ejecuciones',
    drivers: 'Conductores', clients: 'Clientes', reports: 'Informes', alerts: 'Alertas',
    settings: 'Configuración', portalDashboard: 'Panel del cliente',
    portalDeliveries: 'Entregas', portalTracking: 'Seguimiento', portalPod: 'Comprobantes',
  },
  metadata: {
    description: 'Plataforma logística de salud para operaciones de mensajería hospitalaria y de laboratorio',
  },
};

const en = {
  common: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
    create: 'Create', update: 'Update', close: 'Close', search: 'Search', filter: 'Filter',
    loading: 'Loading...', retry: 'Retry', yes: 'Yes', no: 'No', actions: 'Actions',
    status: 'Status', name: 'Name', email: 'Email', phone: 'Phone', address: 'Address',
    date: 'Date', time: 'Time', noResults: 'No results found',
    errorGeneric: 'Something went wrong. Please try again.',
    confirmDelete: 'Are you sure you want to delete?',
    successSaved: 'Saved successfully', successDeleted: 'Deleted successfully',
    back: 'Back', next: 'Next', previous: 'Previous', view: 'View',
    export: 'Export', download: 'Download', active: 'Active', inactive: 'Inactive', all: 'All',
    language: 'Language',
  },
  auth: {
    login: 'Log in', logout: 'Log out', email: 'Email', password: 'Password',
    signIn: 'Sign in', signInTitle: 'Sign in to LOGX Express',
    signInSubtitle: 'Healthcare logistics platform for hospital and lab courier operations',
    sessionExpired: 'Your session has expired. Please sign in again.',
    invalidCredentials: 'Invalid email or password',
    enterEmailPassword: 'Please enter email and password',
    driverApp: 'Driver App', changePassword: 'Change password',
    currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm password',
  },
  nav: {
    dashboard: 'Dashboard', operations: 'Operations', routes: 'Routes', executions: 'Executions',
    drivers: 'Drivers', clients: 'Clients', reports: 'Reports', alerts: 'Alerts',
    settings: 'Settings', portalDashboard: 'Client dashboard',
    portalDeliveries: 'Deliveries', portalTracking: 'Tracking', portalPod: 'Proof of delivery',
  },
  metadata: {
    description: 'Healthcare logistics platform for hospital and laboratory courier operations',
  },
  dashboard: {
    title: 'Live dashboard', subtitle: 'Real-time operations overview',
    activeDrivers: 'Active drivers', routesToday: 'Routes today',
    delayedRoutes: 'Delayed routes', completedToday: 'Completed today',
    liveMap: 'Live map', noDriversOnline: 'No drivers online',
    legend: 'Legend', onRoute: 'On route', idle: 'Idle', delayed: 'Delayed',
  },
  drivers: {
    title: 'Drivers', subtitle: 'Manage drivers and vehicles', addDriver: 'Add driver',
    editDriver: 'Edit driver', noDrivers: 'No drivers registered',
    form: { name: 'Full name', phone: 'Phone', cpf: 'CPF', email: 'Email (login)', password: 'Password',
      vehiclePlate: 'License plate', vehicleModel: 'Model', vehicleYear: 'Year',
      vehicleType: 'Vehicle type', active: 'Active driver' },
  },
  clients: {
    title: 'Clients', subtitle: 'Hospitals, labs and contracts', addClient: 'Add client',
    editClient: 'Edit client', noClients: 'No clients registered',
    geocodeHint: 'Search address to fill coordinates',
    form: { name: 'Name', cnpj: 'CNPJ', type: 'Type', address: 'Address',
      portalEmail: 'Portal email', portalPassword: 'Portal password', active: 'Active client' },
  },
  routes: {
    title: 'Routes', subtitle: 'Route templates and stops', addRoute: 'New route',
    editRoute: 'Edit route', noRoutes: 'No routes registered', stops: 'Stops', addStop: 'Add stop',
    recurrence: 'Recurrence', scheduledTime: 'Scheduled time', daysOfWeek: 'Days of week',
    form: { name: 'Route name', driver: 'Driver', client: 'Client', stopType: 'Stop type',
      expectedDuration: 'Expected duration (min)' },
  },
  executions: {
    title: 'Executions', subtitle: "Today's routes and stop status", noExecutions: 'No executions found',
    substituteDriver: 'Substitute driver', timeline: 'Timeline', stopWorkflow: 'Stop workflow',
    arrive: 'Arrive', start: 'Start', complete: 'Complete', skip: 'Skip stop', waitingTime: 'Waiting time',
  },
  alerts: {
    title: 'Alerts', subtitle: 'Delays and real-time events', noAlerts: 'No alerts',
    delay15: '15 min delay', delay30: '30 min delay', delay60: '60+ min delay', onTime: 'On time',
    acknowledge: 'Acknowledge', geofenceArrival: 'Automatic geofence arrival',
  },
  reports: {
    title: 'Reports', subtitle: 'Metrics and export', startDate: 'Start date', endDate: 'End date',
    generate: 'Generate', exportCsv: 'Export CSV', exportPdf: 'Export PDF',
    totalDeliveries: 'Total deliveries', avgWaitTime: 'Average wait time', onTimeRate: 'On-time rate',
  },
  portal: {
    welcome: 'Welcome to the portal', deliveriesTitle: 'Your deliveries',
    trackingTitle: 'Live tracking', podTitle: 'Proof of delivery', noDeliveries: 'No deliveries in period',
  },
  settings: {
    title: 'Settings', company: 'Company', branches: 'Branches', whatsapp: 'WhatsApp',
    saveSettings: 'Save settings', companyName: 'Company name', cnpj: 'CNPJ',
  },
  mobile: {
    driverApp: 'Driver App', todayRoutes: "Today's routes", noRoutesToday: 'No routes for today',
    routeDetail: 'Route details', stops: 'Stops', startRoute: 'Start route', completeRoute: 'Complete route',
    stopDetail: 'Stop', capturePod: 'Capture proof', photo: 'Photo', signature: 'Signature',
    receiverName: 'Receiver name', routeComplete: 'Route complete',
    routeCompleteMessage: 'All stops have been completed.',
    gpsNotificationTitle: 'LOGX — tracking active',
    gpsNotificationBody: 'Your location is being shared during the route.',
    loginFailed: 'Login failed',
    loadingRoutes: 'Loading routes…',
    stopsProgress: '{completed}/{total} stops',
    minLate: '{minutes} min late',
    back: 'Back',
    gpsActive: 'GPS tracking active',
  },
};

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof target[k] === 'object') {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

for (const [locale, patches] of [['es', es], ['en', en]]) {
  for (const [file, patch] of Object.entries(patches)) {
    const path = join(root, locale, `${file}.json`);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    deepMerge(data, patch);
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  }
}

// ES feature namespaces
const esFeatures = {
  dashboard: { title: 'Panel en vivo', subtitle: 'Vista general de operaciones en tiempo real', activeDrivers: 'Conductores activos', routesToday: 'Rutas hoy', delayedRoutes: 'Rutas retrasadas', completedToday: 'Completadas hoy', liveMap: 'Mapa en vivo', noDriversOnline: 'Ningún conductor en línea', legend: 'Leyenda', onRoute: 'En ruta', idle: 'Inactivo', delayed: 'Retrasado' },
  drivers: { title: 'Conductores', subtitle: 'Gestione conductores y vehículos', addDriver: 'Añadir conductor', editDriver: 'Editar conductor', noDrivers: 'No hay conductores registrados', form: { name: 'Nombre completo', phone: 'Teléfono', cpf: 'CPF', email: 'Correo (acceso)', password: 'Contraseña', vehiclePlate: 'Matrícula', vehicleModel: 'Modelo', vehicleYear: 'Año', vehicleType: 'Tipo de vehículo', active: 'Conductor activo' } },
  clients: { title: 'Clientes', subtitle: 'Hospitales, laboratorios y contratos', addClient: 'Añadir cliente', editClient: 'Editar cliente', noClients: 'No hay clientes registrados', geocodeHint: 'Busque la dirección para coordenadas', form: { name: 'Nombre', cnpj: 'CNPJ', type: 'Tipo', address: 'Dirección', portalEmail: 'Correo del portal', portalPassword: 'Contraseña del portal', active: 'Cliente activo' } },
  routes: { title: 'Rutas', subtitle: 'Plantillas y paradas', addRoute: 'Nueva ruta', editRoute: 'Editar ruta', noRoutes: 'No hay rutas registradas', stops: 'Paradas', addStop: 'Añadir parada', recurrence: 'Recurrencia', scheduledTime: 'Horario', daysOfWeek: 'Días de la semana', form: { name: 'Nombre de ruta', driver: 'Conductor', client: 'Cliente', stopType: 'Tipo de parada', expectedDuration: 'Duración esperada (min)' } },
  executions: { title: 'Ejecuciones', subtitle: 'Rutas del día y estado de paradas', noExecutions: 'No se encontraron ejecuciones', substituteDriver: 'Sustituir conductor', timeline: 'Línea de tiempo', stopWorkflow: 'Flujo de parada', arrive: 'Llegar', start: 'Iniciar', complete: 'Completar', skip: 'Omitir parada', waitingTime: 'Tiempo de espera' },
  alerts: { title: 'Alertas', subtitle: 'Retrasos y eventos en tiempo real', noAlerts: 'Sin alertas', delay15: 'Retraso 15 min', delay30: 'Retraso 30 min', delay60: 'Retraso 60+ min', onTime: 'A tiempo', acknowledge: 'Reconocer', geofenceArrival: 'Llegada automática por geocerca' },
  reports: { title: 'Informes', subtitle: 'Métricas y exportación', startDate: 'Fecha inicial', endDate: 'Fecha final', generate: 'Generar', exportCsv: 'Exportar CSV', exportPdf: 'Exportar PDF', totalDeliveries: 'Total de entregas', avgWaitTime: 'Tiempo medio de espera', onTimeRate: 'Tasa a tiempo' },
  portal: { welcome: 'Bienvenido al portal', deliveriesTitle: 'Sus entregas', trackingTitle: 'Seguimiento en vivo', podTitle: 'Comprobantes de entrega', noDeliveries: 'Sin entregas en el período' },
  settings: { title: 'Configuración', company: 'Empresa', branches: 'Sucursales', whatsapp: 'WhatsApp', saveSettings: 'Guardar configuración', companyName: 'Nombre de la empresa', cnpj: 'CNPJ' },
  mobile: { driverApp: 'App del conductor', todayRoutes: 'Rutas de hoy', noRoutesToday: 'No hay rutas para hoy', routeDetail: 'Detalles de la ruta', stops: 'Paradas', startRoute: 'Iniciar ruta', completeRoute: 'Completar ruta', stopDetail: 'Parada', capturePod: 'Capturar comprobante', photo: 'Foto', signature: 'Firma', receiverName: 'Nombre del receptor', routeComplete: 'Ruta completada', routeCompleteMessage: 'Todas las paradas fueron finalizadas.', gpsNotificationTitle: 'LOGX — seguimiento activo', gpsNotificationBody: 'Su ubicación se comparte durante la ruta.', loginFailed: 'Error de inicio de sesión', loadingRoutes: 'Cargando rutas…', stopsProgress: '{completed}/{total} paradas', minLate: '{minutes} min de retraso', back: 'Volver', gpsActive: 'Seguimiento GPS activo' },
  validation: { invalidEmail: 'Correo inválido', passwordRequired: 'Contraseña obligatoria', currentPasswordRequired: 'Contraseña actual obligatoria', passwordMin: 'La contraseña debe tener al menos 8 caracteres', passwordUppercase: 'Debe contener al menos una mayúscula', passwordNumber: 'Debe contener al menos un número', passwordsDoNotMatch: 'Las contraseñas no coinciden', routeNameMin: 'El nombre debe tener al menos 2 caracteres', daysRequired: 'Seleccione al menos un día', timeFormat: 'Formato HH:mm (ej. 08:45)', stopsRequired: 'Añada al menos una parada', nameMin: 'El nombre debe tener al menos 2 caracteres', invalidPhone: 'Teléfono inválido', cpfDigits: 'CPF debe tener 11 dígitos', plateMin: 'Matrícula mínimo 7 caracteres', cnpjDigits: 'CNPJ debe tener 14 dígitos', addressMin: 'Dirección mínimo 5 caracteres', dateFormat: 'Use formato AAAA-MM-DD', driverIdRequired: 'ID de conductor obligatorio', invalidType: 'Tipo inválido', tooSmall: 'Valor demasiado corto', tooBig: 'Valor demasiado largo', custom: 'Valor inválido' },
  errors: { AUTH_INVALID_CREDENTIALS: 'Correo o contraseña inválidos', AUTH_TOKEN_EXPIRED: 'Token de acceso inválido o expirado', AUTH_TOKEN_MISSING: 'Token de acceso ausente', AUTH_REFRESH_INVALID: 'Token de actualización inválido o expirado', AUTH_REFRESH_REUSE: 'Reuso de token detectado. Sesiones cerradas.', AUTH_USER_INACTIVE: 'Usuario no encontrado o inactivo', AUTH_NOT_AUTHENTICATED: 'No autenticado', FORBIDDEN: 'Acceso denegado', INSUFFICIENT_PERMISSIONS: 'Permisos insuficientes', COMPANY_ACCESS_DENIED: 'Acceso denegado a esta empresa', USER_NOT_FOUND: 'Usuario no encontrado', DRIVER_NOT_FOUND: 'Conductor no encontrado', CLIENT_NOT_FOUND: 'Cliente no encontrado', ROUTE_NOT_FOUND: 'Ruta no encontrada', EXECUTION_NOT_FOUND: 'Ejecución no encontrada', STOP_NOT_FOUND: 'Parada no encontrada', VEHICLE_NOT_FOUND: 'Vehículo no encontrado', BRANCH_NOT_FOUND: 'Sucursal no encontrada', COMPANY_NOT_FOUND: 'Empresa no encontrada', CONTRACT_NOT_FOUND: 'Contrato no encontrado', EMAIL_ALREADY_IN_USE: 'Correo ya en uso', CNPJ_ALREADY_EXISTS: 'Ya existe una empresa con este CNPJ', PLATE_ALREADY_EXISTS: 'Ya existe un vehículo con esta matrícula', DUPLICATE_KEY: 'Ya existe un registro con ese valor', VALIDATION_ERROR: 'Error de validación', INVALID_ID: 'Formato de ID inválido', RATE_LIMITED: 'Demasiados intentos. Espere e intente de nuevo.', DRIVER_EMAIL_PASSWORD_REQUIRED: 'Correo y contraseña obligatorios para la cuenta', CLIENT_PORTAL_CREDENTIALS_REQUIRED: 'Correo y contraseña obligatorios para el portal', CONTRACT_END_BEFORE_START: 'La fecha final debe ser posterior a la inicial', EXECUTION_CANNOT_SUBSTITUTE: 'No se puede sustituir conductor en ejecución completada o cancelada', STOP_ALREADY_STATUS: 'La parada ya está en estado: {status}', STOP_MUST_BE_ARRIVED: 'La parada debe estar en LLEGÓ antes de iniciar', STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS: 'La parada debe estar LLEGÓ o EN CURSO para completar', POD_FILE_REQUIRED: 'Envíe al menos un archivo (foto o firma)', POD_KEY_REQUIRED: 'El parámetro key es obligatorio', INTERNAL_ERROR: 'Error interno del servidor' },
  enums: { userRole: { SUPER_ADMIN: 'Super administrador', ADMIN: 'Administrador', OPERATOR: 'Operador', CLIENT: 'Cliente', DRIVER: 'Conductor' }, vehicleType: { CAR: 'Coche', MOTORCYCLE: 'Moto', VAN: 'Furgoneta', TRUCK: 'Camión' }, clientType: { HOSPITAL: 'Hospital', LABORATORY: 'Laboratorio', OTHER: 'Otro' }, recurrenceType: { DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual', CUSTOM: 'Personalizada' }, routeStopType: { PICKUP: 'Recogida', DELIVERY: 'Entrega', BOTH: 'Recogida y entrega' }, executionStatus: { PENDING: 'Pendiente', ASSIGNED: 'Asignada', ACCEPTED: 'Aceptada', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada' }, stopStatus: { PENDING: 'Pendiente', ARRIVED: 'Llegó', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', SKIPPED: 'Omitida' }, alertType: { DELAY_15: 'Retraso 15 min', DELAY_30: 'Retraso 30 min', DELAY_60: 'Retraso 60+ min', GEOFENCE: 'Geocerca', DRIVER_OFFLINE: 'Conductor offline' } },
  notifications: { delayWhatsApp: 'La ruta {routeName} tiene un retraso de {minutes} minutos.', geofenceArrival: 'El conductor llegó a la parada {stopName}.' },
};

for (const [file, patch] of Object.entries(esFeatures)) {
  const path = join(root, 'es', `${file}.json`);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  deepMerge(data, patch);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// EN errors and enums
const enErrors = JSON.parse(readFileSync(join(root, 'en', 'errors.json'), 'utf8'));
Object.assign(enErrors, {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password', AUTH_TOKEN_EXPIRED: 'Invalid or expired access token',
  AUTH_TOKEN_MISSING: 'Access token missing', AUTH_REFRESH_INVALID: 'Invalid or expired refresh token',
  AUTH_REFRESH_REUSE: 'Refresh token reuse detected. All sessions invalidated.',
  AUTH_USER_INACTIVE: 'User not found or inactive', AUTH_NOT_AUTHENTICATED: 'Not authenticated',
  FORBIDDEN: 'Access denied', INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  COMPANY_ACCESS_DENIED: 'Access denied to this company', USER_NOT_FOUND: 'User not found',
  DRIVER_NOT_FOUND: 'Driver not found', CLIENT_NOT_FOUND: 'Client not found', ROUTE_NOT_FOUND: 'Route not found',
  EXECUTION_NOT_FOUND: 'Execution not found', STOP_NOT_FOUND: 'Stop not found', VEHICLE_NOT_FOUND: 'Vehicle not found',
  BRANCH_NOT_FOUND: 'Branch not found', COMPANY_NOT_FOUND: 'Company not found', CONTRACT_NOT_FOUND: 'Contract not found',
  EMAIL_ALREADY_IN_USE: 'Email already in use', CNPJ_ALREADY_EXISTS: 'A company with this CNPJ already exists',
  PLATE_ALREADY_EXISTS: 'A vehicle with this plate already exists', DUPLICATE_KEY: 'A record with that value already exists',
  VALIDATION_ERROR: 'Validation error', INVALID_ID: 'Invalid ID format', RATE_LIMITED: 'Too many attempts. Please wait and try again.',
  DRIVER_EMAIL_PASSWORD_REQUIRED: 'Email and password required to create account',
  CLIENT_PORTAL_CREDENTIALS_REQUIRED: 'Email and password required for portal',
  CONTRACT_END_BEFORE_START: 'End date must be after start date',
  EXECUTION_CANNOT_SUBSTITUTE: 'Cannot substitute driver on completed or cancelled execution',
  STOP_ALREADY_STATUS: 'Stop is already in status: {status}',
  STOP_MUST_BE_ARRIVED: 'Stop must be in ARRIVED status before starting',
  STOP_MUST_BE_ARRIVED_OR_IN_PROGRESS: 'Stop must be ARRIVED or IN_PROGRESS to complete',
  POD_FILE_REQUIRED: 'At least one file (photo or signature) is required',
  POD_KEY_REQUIRED: 'key query parameter is required', INTERNAL_ERROR: 'Internal server error',
});
writeFileSync(join(root, 'en', 'errors.json'), JSON.stringify(enErrors, null, 2) + '\n');

const enEnumsPath = join(root, 'en', 'enums.json');
const enEnumsData = JSON.parse(readFileSync(enEnumsPath, 'utf8'));
deepMerge(enEnumsData, {
  userRole: { SUPER_ADMIN: 'Super admin', ADMIN: 'Admin', OPERATOR: 'Operator', CLIENT: 'Client', DRIVER: 'Driver' },
  vehicleType: { CAR: 'Car', MOTORCYCLE: 'Motorcycle', VAN: 'Van', TRUCK: 'Truck' },
  clientType: { HOSPITAL: 'Hospital', LABORATORY: 'Laboratory', OTHER: 'Other' },
  recurrenceType: { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', CUSTOM: 'Custom' },
  routeStopType: { PICKUP: 'Pickup', DELIVERY: 'Delivery', BOTH: 'Pickup & delivery' },
  executionStatus: { PENDING: 'Pending', ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' },
  stopStatus: { PENDING: 'Pending', ARRIVED: 'Arrived', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', SKIPPED: 'Skipped' },
  alertType: { DELAY_15: '15 min delay', DELAY_30: '30 min delay', DELAY_60: '60+ min delay', GEOFENCE: 'Geofence', DRIVER_OFFLINE: 'Driver offline' },
});
writeFileSync(enEnumsPath, JSON.stringify(enEnumsData, null, 2) + '\n');

const enValidationPath = join(root, 'en', 'validation.json');
const enValidation = JSON.parse(readFileSync(enValidationPath, 'utf8'));
deepMerge(enValidation, {
  invalidEmail: 'Invalid email address', passwordRequired: 'Password is required',
  currentPasswordRequired: 'Current password is required', passwordMin: 'Password must be at least 8 characters',
  passwordUppercase: 'Password must contain at least one uppercase letter',
  passwordNumber: 'Password must contain at least one number', passwordsDoNotMatch: 'Passwords do not match',
  routeNameMin: 'Route name must be at least 2 characters', daysRequired: 'At least one day is required',
  timeFormat: "Time must be in HH:mm format (e.g. '08:45')", stopsRequired: 'At least one stop is required',
  nameMin: 'Name must be at least 2 characters', invalidPhone: 'Invalid phone number',
  cpfDigits: 'CPF must be 11 digits', plateMin: 'Plate must be at least 7 characters',
  cnpjDigits: 'CNPJ must be 14 digits', addressMin: 'Address must be at least 5 characters',
  dateFormat: 'Use YYYY-MM-DD format', driverIdRequired: 'Driver ID is required',
  invalidType: 'Invalid type', tooSmall: 'Value too short', tooBig: 'Value too long', custom: 'Invalid value',
});
writeFileSync(enValidationPath, JSON.stringify(enValidation, null, 2) + '\n');

console.log('Translations seeded');
