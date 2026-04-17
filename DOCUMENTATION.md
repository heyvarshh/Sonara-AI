# IntentCast / Sonora AI: Engineering & Design Specification

## 1. System Overview
IntentCast is an Augmented and Alternative Communication (AAC) system engineered for pediatric users with speech impairments or non-verbal conditions. The architecture performs real-time multimodal fusion—aggregating fragmented speech acoustics, facial micro-expressions, and physical gestures—to reconstruct grammatically correct and emotionally contextualized speech.

The following document serves as the implementation specification for the engineering and design teams, standardizing performance targets, user interface parameters, layout constraints, and logical flows.

---

## 2. Interaction & Performance Targets

Concrete performance baselines ensure the communication loop feels instantaneous and prevents user frustration.

### Latency Constraints
*   **Processing Screen Latency:** `< 300ms`
    *   *Rationale:* Users must receive immediate visual confirmation that the system is processing their input to prevent repetitive triggering or abandonment.
*   **Emergency Panel Activation Latency:** `< 500ms`
    *   *Rationale:* Critical health and safety requests must be fulfilled within half a second to guarantee reliability during distress.
*   **Tactile Feedback Latency:** `< 100ms`
    *   *Rationale:* Immediate UI state-change on button interaction is required to confirm successful target acquisition.

### Touch & Accessibility Parameters
*   **Component Sizing:** Minimum `60px` by `60px` touch targets; `80px` preferred.
    *   *Rationale:* Accommodates users with varying degrees of fine motor control and prevents misclicks.
*   **Action Triggers:** All emergency and core communication interactions must fire on `press-down` (`touchstart` / `mousedown`), not on `release` (`touchend` / `mouseup`).
    *   *Rationale:* Reduces the cognitive and physical load required to execute a command, particularly for users experiencing muscle fatigue or spasms.

---

## 3. Core Interface Specifications

### The Emergency Panel (Hardened Mode)
The emergency panel is an isolated, hardened state prioritizing extreme reliability and speed over complex communication. 

*   **Speech Triggering:** As specified above, all emergency synthesized speech must fire on `press-down`. 
*   **Touch-Isolated Microphone:** The panel must feature a dedicated, manually-triggered microphone element for unmuting when the patient is speaking. 
    *   *Implementation:* This microphone can **only** be accessed and activated through direct, physical touch. Voice-activation or gesture-activation for this specific mic is disabled.
    *   *Rationale:* Guarantees the system does not pick up ambient emergency noise or false positives, ensuring the patient's explicit vocalizations are only transmitted when physically intended.

### Calm Mode Parameters
Calm Mode handles sensory overload, a common requirement for the target demographic. When triggered, the system enforces the following parameters:

*   **Visual Output:** Overall interface brightness is capped at `40%`. Interface contrast is softened to prevent harsh transitions. Bright, saturated colors are replaced with muted, low-stimuli palettes (e.g., `#2C3E50`, `#34495E`).
*   **Audio Output:** The Text-to-Speech (TTS) voice profile is modified. Volume is reduced by `30%`, speaking pace is lowered by `15%`, and pitch variation is smoothed to reduce jarring auditory spikes.
*   **Exit Conditions:** Calm Mode cannot be exited via complex voice commands. It requires an explicit, deliberate action (e.g., a two-second long-press on a dedicated UI element) to prevent accidental reversion to high-stimuli mode.
    *   *Rationale:* Protects the user from sudden sensory spikes while allowing a predictable, reliable recovery path.

---

## 4. Backend System Architecture

The system utilizes an decoupled Edge-Sensor + Parallel Inference model to operate within the defined latency constraints.

### 4.1 Edge Capture (Frontend)
*   **Landmark Tracking:** Incorporates MediaPipe for tracking 478 facial landmarks and hand gestures via the client device.
*   **Data Payload:** Constructs a synchronized JSON object consisting of a 1.5s audio buffer and visual metadata (face crops and gesture coordinates).
*   **Data Transport:** Transmits payloads to the backend via a persistent, low-latency WebSocket connection.

### 4.2 Asynchronous Processing (Backend)
The FastAPI backend utilizes parallel asynchronous execution (`asyncio.gather`) to run three distinct models within the latency budget:
*   **Literal Transcript Generation:** Pipeline utilizing `Sarvam STT` to extract decipherable word fragments.
*   **Acoustic Context Analysis:** Pipeline utilizing `SenseVoice` to calculate RMS energy and pitch variance, determining stress, urgency, or fatigue.
*   **Visual Context Analysis:** Pipeline utilizing `HSEmotionONNX` on face crops to categorize micro-expressions.

### 4.3 Intent Reconstruction
*   **Consensus State:** The parallel outputs are synthesized into a unified structured object.
*   **LLM Pipeline:** Gemini 1.5 Flash evaluates the Consensus State. Prompts enforce strict brevity constraints to expand fragmented speech (e.g., "wa... ter", Stressed) into explicit actionable sentences ("I need water right now").
*   **Text-to-Speech (TTS):** The reconstructed sentence is routed to `Sarvam TTS`. Voice parameters (pace, speaker model) are dynamically assigned based on the evaluated emotional state.

---

## 5. Development Setup & Deployment

### Environment Requirements
*   **Backend:** Python 3.10+
*   **Frontend:** Node.js 18+

### Initialization
```bash
# Backend Installation & Execution
pip install fastapi uvicorn requests librosa numpy opencv-python hsemotion-onnx google-genai mediapipe
export SARVAM_API_KEY="<production_key>"
export GEMINI_API_KEY="<production_key>"
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend Installation & Execution
cd frontend
npm install
npm run dev
```
