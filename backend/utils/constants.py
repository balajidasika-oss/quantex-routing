"""Constants, emission factors, QUBO penalties, and physical parameters."""

# CO2 Emission Factors (in kg CO2 per kilometer)
CO2_FACTORS = {
    "DIESEL": 0.268,      # Standard light commercial diesel van
    "HYBRID": 0.145,      # Hybrid delivery vehicle
    "ELECTRIC": 0.048,    # Well-to-wheel average grid electricity equivalent
}

# Average Fuel / Energy consumption per km
CONSUMPTION_PER_KM = {
    "DIESEL": 0.095,      # Liters / km (~9.5 L / 100 km)
    "HYBRID": 0.052,      # Liters / km (~5.2 L / 100 km)
    "ELECTRIC": 0.210,    # kWh / km (commercial EV delivery van)
}

# QUBO Penalty Default Multipliers
QUBO_DEFAULTS = {
    "VISIT_PENALTY_MULTIPLIER": 120.0,     # Penalty for missing or visiting a stop > 1 time
    "STEP_PENALTY_MULTIPLIER": 120.0,      # Penalty for multiple stops at same step
    "CAPACITY_PENALTY_MULTIPLIER": 80.0,   # Penalty for vehicle overload
    "QAOA_P_DEPTH": 2,                     # Default layers of QAOA circuit
    "QAOA_SHOTS": 1024,                    # Number of circuit measurement shots
    "GRID_SEARCH_STEPS": 10,               # Gamma, Beta discretization steps
}

# EV Physics & Battery Parameters (for typical electric commercial van)
EV_SPECS = {
    "BATTERY_CAPACITY_KWH": 75.0,         # Nominal pack capacity in kWh
    "CURB_WEIGHT_KG": 2200.0,             # Empty vehicle mass
    "MAX_PAYLOAD_KG": 1200.0,             # Max cargo capacity
    "AIR_DENSITY": 1.225,                 # kg/m^3 at sea level
    "DRAG_COEFFICIENT": 0.35,             # Aerodynamic Cd
    "FRONTAL_AREA_M2": 3.8,               # Frontal cross-sectional area
    "ROLLING_RESISTANCE_COEFF": 0.012,    # Tire rolling resistance Crr
    "GRAVITY_M_S2": 9.80665,              # Acceleration due to gravity
    "POWERTRAIN_EFFICIENCY": 0.88,        # Battery to wheels motor efficiency
    "REGEN_BRAKING_EFFICIENCY": 0.65,     # Kinetic energy recovery efficiency
    "AUXILIARY_POWER_KW": 1.5,            # HVAC, lighting, infotainment power draw
    "OPTIMAL_TEMP_C": 22.0,               # Ideal battery operating temperature
}

# Geofence Corridor Defaults
GEOFENCE_CORRIDOR_WIDTH_METERS = 120.0     # Normal permissible deviation corridor
GEOFENCE_WARNING_METERS = 180.0            # Warning threshold
GEOFENCE_CRITICAL_METERS = 300.0           # Critical deviation threshold

# Roles
ROLE_ADMIN = "ADMIN"
ROLE_DISPATCHER = "DISPATCHER"
ROLE_DRIVER = "DRIVER"
ALL_ROLES = [ROLE_ADMIN, ROLE_DISPATCHER, ROLE_DRIVER]
