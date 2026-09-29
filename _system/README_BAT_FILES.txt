SD Dynamics — Fixed Windows .bat files
=====================================

WHY YOUR .BAT FILES DID NOT WORK
--------------------------------
They contained unresolved Git merge conflict markers:

  <<<<<<< HEAD
  ...
  =======
  ...
  >>>>>>> 220786a...

cmd.exe treats those as invalid commands and stops.
Admin rights do NOT fix merge-conflict garbage.

HOW TO INSTALL THESE
--------------------
1. Copy every .bat from this ZIP into your project root
   (same folder as package.json and server.js).
2. Double-click: Install FreeGSTBill.bat
   - No Administrator required
   - If SmartScreen appears: More info → Run anyway
3. Then use: Start FreeGSTBill.bat

Update FreeGSTBill.bat now downloads from YOUR fork:
  https://github.com/veeranki97/SD-Dynamics
so official Free-GST-Billing updates will not wipe SD Dynamics features.

MANUAL FALLBACK
---------------
In project folder, PowerShell:

  npm install
  npm run build
  node server.js

Open the localhost URL printed in the window.
