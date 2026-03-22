PROJECT CONTEXT (READ BEFORE MODIFYING THE CODE)

This project is a mobile safety and smart navigation application designed to help people feel safe while travelling, especially at night. The main goal of the application is to prove real-time safety assistance, predict unsafe areas, and automatically respond in emergency situations.

This is NOT a normal maps application and NOT just a panic button app. The project combines:

Real-time location tracking
Safety heatmap generation
Safe-route navigation
Emergency contact system
AI-based safety intelligence

The product should behave like a personal AI safety assistant that protects the user while they are travelling.

WHAT THE APPLICATION CURRENTLY DOES

The application already includes the following core features:

Live Location Tracking
The app continuously tracks the user’s location in real time and uses it to calculate safety levels and detect risky zones.
Safety Heatmap
The map shows dangerous areas using different colors (green = safe, yellow = moderate risk, red = unsafe).
These zones are based on:
User reports
Location data
Time of day
Risk scoring logic
Anonymous Danger Reporting
Users can report unsafe places such as:
Dark streets
Suspicious areas
Unsafe roads
Harassment-prone zones

These reports are used to improve the safety heatmap.

Emergency Contact System
The user can add trusted contacts.
In an emergency situation, the app shares the user’s live location with these contacts.
Basic Safe Navigation
The user can enter a source and destination, and the system suggests routes while avoing unsafe areas when possible.
WHAT THIS PROJECT IS TRYING TO BECOME

This project is evolving into an AI-powered city safety platform with advanced features such as:

Predicting danger before it happens
Detecting when a user is in trouble automatically
Allowing families to track each other safely
Verifying unsafe areas using images
Proving the safest possible routes instead of just the shortest ones

The final goal is to build a real-world startup-level product, not just a college project.

FEATURES THAT MUST BE ADDED / ENHANCED

The following features must be implemented inse the existing codebase.
Do NOT remove existing logic. Only enhance it.

1. Family Safety Dashboard

The emergency contact system must be upgraded into a real-time family safety network.

New behavior:

All emergency contacts can share live location with each other.
A main dashboard screen must show:
Location of all connected members
Whether each person is safe or in a risky zone
Last active time
Safety score of their current location
Movement status (moving / stopped / unknown)

The dashboard should look like a control center for safety.

2. Image-Based Safety Verification

When a user reports an unsafe area, the app should ask the user to upload an image to verify the report.

The system must:

Accept an image upload
Analyze whether the image actually shows:
A dark road
Poor lighting
Empty street
Unsafe surroundings

The result of this analysis should increase or decrease the safety rating of that location.

3. Advanced Safe Route System

The navigation feature must be upgraded to show multiple route types:

Safest Route
Balanced Route (safe + fast)
Fastest Route

Each route must display:

Safety score
Estimated time
Risk level
Number of unsafe areas on the route

The routing system should focus on safety-first navigation, not just distance.

4. Codeword-Based Danger Detection

The user must set a secret safety codeword.

When the user enters a high-risk area:

The app asks the user to enter the codeword to confirm they are safe.

If the user does NOT respond:

After 3 attempts:

Start audio recording automatically
Notify emergency contacts

After 5 attempts:

Show nearby police stations
Show nearby hospitals
Show emergency contact quick-call buttons

This system should work automatically without the user pressing a panic button.

5. Intelligent Safety Escalation System

The app must respond in stages:

Stage 1 → Warning
Stage 2 → Reminder
Stage 3 → Audio recording starts
Stage 4 → Emergency contacts notified
Stage 5 → Police and hospital numbers shown
Stage 6 → Continuous live location sharing starts

WHAT THE AI MODEL SHOULD DO WITH THIS PROJECT

The AI should:

Understand the purpose of the application before editing any files
Extend the existing logic instead of replacing it
Keep the UI clean and simple
Maintain scalability and real-world usability
Write production-quality code (not quick hack code)
FINAL PROJECT GOAL

The final product should feel like:

A smart personal safety assistant
A real-time family safety platform
A safety-first navigation system
A product that can become a real startup