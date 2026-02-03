import * as fs from 'fs';
import * as path from 'path';

// Master OEM data
const manufacturers = [
  {
    make: "Lexus",
    years: "2018-2026",
    source: "Toyota_Lexus_Scion_Position_Statement__Pre_and_PostRepair_System_Scanning.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Sensor",
        oem_name: "Lexus Safety System+ Radar",
        description: "Dynamic Radar Cruise Control, Pre-Collision System",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Forward Facing Camera",
        oem_name: "Lexus Safety System+ Camera",
        description: "Lane Departure Alert, Lane Keep Assist, Road Sign Assist",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Blind Spot Monitor Sensor",
        oem_name: "Blind Spot Monitor (BSM)",
        description: "Blind Spot Monitor, Rear Cross-Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Sensor"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Sensor"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Monitor Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Forward Facing Camera"] }
    ]
  },
  {
    make: "Acura",
    years: "2018-2026",
    source: "Acura_Pos_AcuraWatch360BumperCoverRepairs42624.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Sensor",
        oem_name: "AcuraWatch Radar",
        description: "Adaptive Cruise Control, Collision Mitigation Braking",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "AcuraWatch Camera",
        oem_name: "AcuraWatch Camera",
        description: "Lane Keeping Assist, Road Departure Mitigation",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Blind Spot Information",
        oem_name: "Blind Spot Information System",
        description: "Blind Spot Information, Rear Cross Traffic",
        location: "rear bumper corners",
        calibration_type: "Static"
      },
      {
        system_name: "AcuraWatch 360 Cameras",
        oem_name: "AcuraWatch 360",
        description: "Surround View, 360 Camera",
        location: "front, sides, rear",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Sensor", "AcuraWatch 360 Cameras"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Sensor"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Information", "AcuraWatch 360 Cameras"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["AcuraWatch Camera"] },
      { operation: "Side Mirror R&I/R&R", keywords: ["side mirror", "door mirror", "outside mirror", "mirror assembly", "r&i mirror", "r&r mirror"], triggers: ["AcuraWatch 360 Cameras"] }
    ]
  },
  {
    make: "Hyundai",
    years: "2018-2026",
    source: "Hyundai_Pos_PreRepairandPostRepairSystemScanning_Revised6325.pdf",
    adas_systems: [
      {
        system_name: "Forward Collision-Avoidance Radar",
        oem_name: "Forward Collision-Avoidance Assist Radar",
        description: "Forward Collision-Avoidance Assist, Smart Cruise Control, Highway Driving Assist",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Hyundai SmartSense Camera",
        description: "Lane Following Assist, Lane Keeping Assist, Lane Departure Warning, Highway Driving Assist",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Blind-Spot Collision-Avoidance Sensor",
        oem_name: "Blind-Spot Collision-Avoidance Assist Sensor",
        description: "Blind-Spot Collision-Avoidance Assist, Rear Cross-Traffic Collision-Avoidance Assist, Safe Exit Warning",
        location: "rear bumper corners",
        calibration_type: "Static"
      },
      {
        system_name: "Parking Sensors",
        oem_name: "Parking Distance Warning",
        description: "Parking Distance Warning, Parking Collision-Avoidance Assist",
        location: "front and rear bumpers",
        calibration_type: "Coding"
      },
      {
        system_name: "Surround View Monitor",
        oem_name: "Surround View Monitor",
        description: "Surround View Monitor, 360 Camera",
        location: "front, sides, rear",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Forward Collision-Avoidance Radar", "Parking Sensors", "Surround View Monitor"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Forward Collision-Avoidance Radar"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind-Spot Collision-Avoidance Sensor", "Parking Sensors", "Surround View Monitor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Blind-Spot Collision-Avoidance Sensor"] },
      { operation: "Side Mirror R&I/R&R", keywords: ["side mirror", "door mirror", "outside mirror", "mirror assembly", "r&i mirror", "r&r mirror"], triggers: ["Surround View Monitor"] }
    ]
  },
  {
    make: "Genesis",
    years: "2018-2026",
    source: "Genesis_Pos_PreRepairandPostRepairScanning423.pdf",
    adas_systems: [
      {
        system_name: "Forward Collision Radar",
        oem_name: "Forward Collision-Avoidance Assist Radar",
        description: "Forward Collision-Avoidance Assist, Smart Cruise Control, Highway Driving Assist",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Highway Driving Assist Camera",
        description: "Lane Following Assist, Highway Driving Assist II",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Blind-Spot Sensor",
        oem_name: "Blind-Spot Collision-Avoidance Assist",
        description: "Blind-Spot Collision-Avoidance Assist, Rear Cross-Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Forward Collision Radar"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Forward Collision Radar"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind-Spot Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Blind-Spot Sensor"] }
    ]
  },
  {
    make: "Subaru",
    years: "2018-2026",
    source: "Subaru_Pos_Eyesight_FINAL41620.pdf",
    adas_systems: [
      {
        system_name: "EyeSight Camera System",
        oem_name: "EyeSight Driver Assist Technology",
        description: "Pre-Collision Braking, Adaptive Cruise Control, Lane Departure Warning, Lane Keep Assist, EyeSight",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Front Radar",
        oem_name: "Front Radar Sensor",
        description: "Adaptive Cruise Control, Pre-Collision System",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Blind Spot Detection Sensor",
        oem_name: "Blind Spot Detection / RCTA",
        description: "Blind Spot Detection, Lane Change Assist, Rear Cross Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      },
      {
        system_name: "Rear View Camera",
        oem_name: "Rear Vision Camera",
        description: "Rear Vision Camera, Reverse Automatic Braking",
        location: "liftgate",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["EyeSight Camera System"] },
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Detection Sensor"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Blind Spot Detection Sensor"] },
      { operation: "Liftgate R&I/R&R", keywords: ["liftgate", "tailgate", "rear gate", "hatch", "trunk lid"], triggers: ["Rear View Camera"] },
      { operation: "Wheel Alignment", keywords: ["alignment", "wheel alignment", "four wheel alignment", "4 wheel alignment"], triggers: ["EyeSight Camera System"] },
      { operation: "Suspension Repair", keywords: ["suspension", "strut", "shock", "control arm", "subframe"], triggers: ["EyeSight Camera System"] }
    ]
  },
  {
    make: "Chevrolet",
    years: "2018-2026",
    source: "gmgpwindshieldreplacementpositionstatementfeb272025.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Module",
        oem_name: "Forward Collision Alert / ACC Radar",
        description: "Adaptive Cruise Control, Forward Collision Alert, Automatic Emergency Braking, Super Cruise",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Forward Camera System",
        description: "Lane Keep Assist, Lane Departure Warning, IntelliBeam, Super Cruise",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Blind Zone Alert Sensor",
        oem_name: "Side Blind Zone Alert",
        description: "Side Blind Zone Alert, Lane Change Alert, Rear Cross Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      },
      {
        system_name: "Ultrasonic Parking Sensors",
        oem_name: "Front/Rear Park Assist",
        description: "Front Parking Assist, Rear Park Assist, Automatic Parking Assist",
        location: "front and rear bumpers",
        calibration_type: "Coding"
      },
      {
        system_name: "Surround Vision Camera",
        oem_name: "Surround Vision",
        description: "Surround Vision, Rear Vision Camera",
        location: "front, sides, rear",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module", "Ultrasonic Parking Sensors", "Surround Vision Camera"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Blind Zone Alert Sensor", "Ultrasonic Parking Sensors", "Surround Vision Camera"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Side Blind Zone Alert Sensor"] },
      { operation: "Side Mirror R&I/R&R", keywords: ["side mirror", "door mirror", "outside mirror", "mirror assembly", "r&i mirror", "r&r mirror"], triggers: ["Surround Vision Camera"] },
      { operation: "Tailgate R&I/R&R", keywords: ["tailgate", "liftgate", "trunk lid", "decklid"], triggers: ["Surround Vision Camera"] }
    ]
  },
  {
    make: "GMC",
    years: "2018-2026",
    source: "gmgpwindshieldreplacementpositionstatementfeb272025.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Module",
        oem_name: "Forward Collision Alert / ACC Radar",
        description: "Adaptive Cruise Control, Forward Collision Alert, Automatic Emergency Braking, Super Cruise",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Forward Camera System",
        description: "Lane Keep Assist, Lane Departure Warning, Super Cruise",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Blind Zone Alert Sensor",
        oem_name: "Side Blind Zone Alert",
        description: "Side Blind Zone Alert, Rear Cross Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Blind Zone Alert Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Side Blind Zone Alert Sensor"] }
    ]
  },
  {
    make: "Cadillac",
    years: "2018-2026",
    source: "gmgpwindshieldreplacementpositionstatementfeb272025.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Module",
        oem_name: "Super Cruise / Ultra Cruise Radar",
        description: "Super Cruise, Adaptive Cruise Control, Enhanced Automatic Emergency Braking",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Super Cruise / Ultra Cruise Camera",
        description: "Super Cruise, Lane Keep Assist, Lane Departure Warning, Ultra Cruise",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Blind Zone Alert Sensor",
        oem_name: "Side Blind Zone Alert",
        description: "Side Blind Zone Alert, Rear Cross Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Blind Zone Alert Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Side Blind Zone Alert Sensor"] }
    ]
  },
  {
    make: "BMW",
    years: "2018-2026",
    source: "General OEM Position Statements",
    adas_systems: [
      {
        system_name: "Front Radar Sensor",
        oem_name: "Active Cruise Control Radar",
        description: "Active Cruise Control, Frontal Collision Warning, City Collision Mitigation",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Driving Assistant Camera",
        description: "Lane Departure Warning, Lane Keeping Assistant, Traffic Sign Recognition, Driving Assistant Professional",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Radar Sensors",
        oem_name: "Active Blind Spot Detection Sensors",
        description: "Active Blind Spot Detection, Lane Change Warning, Rear Cross-Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      },
      {
        system_name: "Park Distance Control",
        oem_name: "Park Distance Control / Parking Assistant",
        description: "Park Distance Control, Parking Assistant",
        location: "front and rear bumpers",
        calibration_type: "Coding"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Sensor", "Park Distance Control"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Sensor"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Radar Sensors", "Park Distance Control"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] }
    ]
  },
  {
    make: "Volkswagen",
    years: "2018-2026",
    source: "Audi_Position_WindshieldGlass_Replacement813pdf1.pdf",
    adas_systems: [
      {
        system_name: "Front Assist Radar",
        oem_name: "Front Assist / ACC Radar",
        description: "Front Assist, Adaptive Cruise Control, Autonomous Emergency Braking",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Lane Assist / Travel Assist Camera",
        description: "Lane Assist, Traffic Sign Recognition, Light Assist, Travel Assist",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Assist Sensor",
        oem_name: "Side Assist Sensors",
        description: "Side Assist, Rear Traffic Alert, Lane Change Assist",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Assist Radar"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Assist Radar"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Assist Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Side Assist Sensor"] }
    ]
  },
  {
    make: "Jeep",
    years: "2018-2026",
    source: "MoparGlassReplacementPositionStatement.pdf",
    adas_systems: [
      {
        system_name: "Forward Facing Camera",
        oem_name: "Active Driving Assist Camera",
        description: "Active Driving Assist, Forward Collision Warning, LaneSense",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Front Radar Module",
        oem_name: "Active Driving Assist Radar",
        description: "Active Driving Assist, Adaptive Cruise Control, Full Speed Forward Collision Warning Plus",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Blind Spot Monitor Sensor",
        oem_name: "Blind Spot Monitoring",
        description: "Blind Spot Monitoring, Rear Cross Path Detection",
        location: "rear bumper corners",
        calibration_type: "Static"
      },
      {
        system_name: "Parking Sensors",
        oem_name: "ParkSense",
        description: "ParkSense, Parallel/Perpendicular Park Assist",
        location: "front and rear bumpers",
        calibration_type: "Coding"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module", "Parking Sensors"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Monitor Sensor", "Parking Sensors"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Forward Facing Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Blind Spot Monitor Sensor"] }
    ]
  },
  {
    make: "Ram",
    years: "2018-2026",
    source: "MoparGlassReplacementPositionStatement.pdf",
    adas_systems: [
      {
        system_name: "Forward Facing Camera",
        oem_name: "Forward Collision Warning Camera",
        description: "Adaptive Cruise Control, Forward Collision Warning, LaneSense",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Front Radar Module",
        oem_name: "Adaptive Cruise Control Radar",
        description: "Adaptive Cruise Control, Full Speed Forward Collision Warning Plus",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Blind Spot Monitor Sensor",
        oem_name: "Blind Spot Monitoring / Trailer Detection",
        description: "Blind Spot Monitoring, Trailer Detection, Rear Cross Path Detection",
        location: "rear bumper / tailgate",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Monitor Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Forward Facing Camera"] },
      { operation: "Tailgate R&I/R&R", keywords: ["tailgate", "tail gate", "rear gate"], triggers: ["Blind Spot Monitor Sensor"] }
    ]
  },
  {
    make: "Dodge",
    years: "2018-2026",
    source: "MoparGlassReplacementPositionStatement.pdf",
    adas_systems: [
      {
        system_name: "Forward Facing Camera",
        oem_name: "Forward Collision Warning Camera",
        description: "Adaptive Cruise Control, Forward Collision Warning, LaneSense",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Front Radar Module",
        oem_name: "Adaptive Cruise Control Radar",
        description: "Adaptive Cruise Control, Full Speed Forward Collision Warning",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Blind Spot Monitor Sensor",
        oem_name: "Blind Spot Monitoring",
        description: "Blind Spot Monitoring, Rear Cross Path Detection",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Monitor Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Forward Facing Camera"] }
    ]
  },
  {
    make: "Chrysler",
    years: "2018-2026",
    source: "MoparGlassReplacementPositionStatement.pdf",
    adas_systems: [
      {
        system_name: "Forward Facing Camera",
        oem_name: "Forward Collision Warning Camera",
        description: "Adaptive Cruise Control, Forward Collision Warning, LaneSense",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Front Radar Module",
        oem_name: "Adaptive Cruise Control Radar",
        description: "Adaptive Cruise Control, Full Speed Forward Collision Warning Plus",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Blind Spot Monitor Sensor",
        oem_name: "Blind Spot Monitoring",
        description: "Blind Spot Monitoring, Rear Cross Path Detection",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Monitor Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Forward Facing Camera"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Blind Spot Monitor Sensor"] }
    ]
  },
  {
    make: "Tesla",
    years: "2018-2026",
    source: "Tesla Service Information",
    adas_systems: [
      {
        system_name: "Front Facing Cameras",
        oem_name: "Autopilot / FSD Cameras",
        description: "Autopilot, Full Self-Driving, Traffic-Aware Cruise Control, Autosteer",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Ultrasonic Sensors",
        oem_name: "Parking Sensors",
        description: "Parking Assist, Summon",
        location: "front and rear bumpers",
        calibration_type: "Coding"
      },
      {
        system_name: "Side Cameras",
        oem_name: "B-Pillar / Fender Cameras",
        description: "Autopilot, Blind Spot Warning, Lane Change",
        location: "front fenders / b-pillars",
        calibration_type: "Static"
      },
      {
        system_name: "Rear Cameras",
        oem_name: "Trunk / Liftgate Camera",
        description: "Autopilot, Rear View Camera",
        location: "trunk lid / liftgate",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Facing Cameras"] },
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Ultrasonic Sensors"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Ultrasonic Sensors"] },
      { operation: "Front Fender R&I/R&R", keywords: ["front fender", "fender", "frt fender", "f fender"], triggers: ["Side Cameras"] },
      { operation: "B-Pillar Repair", keywords: ["b-pillar", "b pillar", "center pillar"], triggers: ["Side Cameras"] },
      { operation: "Trunk/Liftgate R&I/R&R", keywords: ["trunk lid", "liftgate", "tailgate", "decklid", "rear hatch"], triggers: ["Rear Cameras"] }
    ]
  },
  {
    make: "Lincoln",
    years: "2018-2026",
    source: "FORD_Position_Statement_ADAS_Scanning__FNL_93025.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Module",
        oem_name: "Lincoln Co-Pilot360 Radar",
        description: "Adaptive Cruise Control, Pre-Collision Assist, Lincoln Co-Pilot360",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera Module",
        oem_name: "Lincoln Co-Pilot360 Camera",
        description: "Lane Keeping, Traffic Sign Recognition, ActiveGlide",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Blind Spot Radar",
        oem_name: "Blind Spot Detection Sensors",
        description: "Blind Spot Detection, Cross-Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Blind Spot Radar"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera Module"] },
      { operation: "Quarter Panel Repair", keywords: ["quarter panel", "qtr panel", "rear quarter", "rpr quarter"], triggers: ["Blind Spot Radar"] }
    ]
  },
  {
    make: "Buick",
    years: "2018-2026",
    source: "gmgpwindshieldreplacementpositionstatementfeb272025.pdf",
    adas_systems: [
      {
        system_name: "Front Radar Module",
        oem_name: "Forward Collision Alert Radar",
        description: "Adaptive Cruise Control, Forward Collision Alert",
        location: "front grille/bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Lane Keep Assist Camera",
        description: "Lane Keep Assist, Lane Departure Warning",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Blind Zone Alert Sensor",
        oem_name: "Side Blind Zone Alert",
        description: "Side Blind Zone Alert, Rear Cross Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Module"] },
      { operation: "Front Grille R&I/R&R", keywords: ["grille", "front grille", "radiator grille", "grill", "r&i grille", "r&r grille"], triggers: ["Front Radar Module"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Blind Zone Alert Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] }
    ]
  },
  {
    make: "Porsche",
    years: "2018-2026",
    source: "General OEM Position Statements",
    adas_systems: [
      {
        system_name: "Front Radar Sensor",
        oem_name: "Adaptive Cruise Control / InnoDrive Radar",
        description: "Adaptive Cruise Control, Porsche InnoDrive",
        location: "front bumper",
        calibration_type: "Static/Dynamic"
      },
      {
        system_name: "Front Camera",
        oem_name: "Lane Keep Assist Camera",
        description: "Lane Keep Assist, Traffic Sign Recognition",
        location: "windshield",
        calibration_type: "Static"
      },
      {
        system_name: "Side Assist Sensor",
        oem_name: "Lane Change Assist Sensors",
        description: "Lane Change Assist, Rear Cross Traffic Alert",
        location: "rear bumper corners",
        calibration_type: "Static"
      }
    ],
    repair_mappings: [
      { operation: "Front Bumper R&I/R&R", keywords: ["front bumper", "frt bumper", "f bumper", "front fascia", "bumper cover", "r&i front bumper", "r&r front bumper", "o/h front bumper", "o/h bumper", "rpr front bumper", "rpr bumper"], triggers: ["Front Radar Sensor"] },
      { operation: "Rear Bumper R&I/R&R", keywords: ["rear bumper", "rr bumper", "r bumper", "rear fascia", "r&i rear bumper", "r&r rear bumper", "o/h rear bumper", "rpr rear bumper"], triggers: ["Side Assist Sensor"] },
      { operation: "Windshield R&I/R&R", keywords: ["windshield", "windscreen", "front glass", "w/s glass"], triggers: ["Front Camera"] }
    ]
  }
];

function generateJson(mfr: typeof manufacturers[0]): object {
  const [yearStart, yearEnd] = mfr.years.split('-').map(Number);

  return {
    vehicle: {
      year_start: yearStart,
      year_end: yearEnd,
      make: mfr.make,
      model: "All Models"
    },
    source: {
      provider: `${mfr.make} Position Statement`,
      url: mfr.source,
      date_extracted: "2026-01-29"
    },
    adas_systems: mfr.adas_systems.map(sys => ({
      system_name: sys.system_name,
      oem_name: sys.oem_name,
      description: sys.description,
      location: sys.location,
      dtc_set: true,
      scan_tool_required: true,
      calibration_type: sys.calibration_type,
      calibration_triggers: [
        "Component replacement",
        "After collision repair"
      ]
    })),
    repair_to_calibration_map: mfr.repair_mappings.map(mapping => ({
      repair_operation: mapping.operation,
      repair_keywords: mapping.keywords,
      triggers_calibration: mapping.triggers,
      notes: `${mapping.operation} requires ${mapping.triggers.join(', ')} calibration`
    }))
  };
}

// Generate JSON files
const dataDir = path.join(__dirname, '..', 'data');

for (const mfr of manufacturers) {
  const json = generateJson(mfr);
  const fileName = `${mfr.make.toLowerCase().replace(/\s+/g, '-')}-all-models.json`;
  const dirPath = path.join(dataDir, mfr.make);
  const filePath = path.join(dirPath, fileName);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  console.log(`Created: ${filePath}`);
}

console.log('\nDone! Created JSON files for all manufacturers.');
