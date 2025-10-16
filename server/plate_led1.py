# file: plate_live.py
import cv2
import easyocr
import re
import numpy as np
import pymongo
import os
import socket
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------
# Database Setup
# ------------------------------
def init_db():
    db_username = os.getenv('DB_USERNAME')
    db_password = os.getenv('DB_PASSWORD')
    if not db_username or not db_password:
        logger.error("DB_USERNAME and DB_PASSWORD environment variables must be set.")
        raise ValueError("Missing database credentials in environment variables.")

    # MongoDB connection string using environment variables
    mongo_uri = f"mongodb+srv://{db_username}:{db_password}@cluster0.0amy0ov.mongodb.net/sves?retryWrites=true&w=majority&appName=Cluster0"
    try:
        client = pymongo.MongoClient(mongo_uri)
        # Test the connection
        client.admin.command('ping')
        logger.info("✅ Connected to MongoDB")
        db = client['sves']
        return db
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        raise

def check_plate(db, plate_text):
    try:
        vehicles_collection = db['vehicles']
        vehicle = vehicles_collection.find_one({"licensePlate": plate_text})
        return vehicle is not None
    except Exception as e:
        logger.error(f"❌ Error querying database for plate {plate_text}: {e}")
        return False


# ------------------------------
# ESP32 UDP Setup
# ------------------------------
ESP32_IP = os.getenv('ESP32_IP', '192.168.137.225')  # Default IP if not set
ESP32_PORT = 4210
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

def flash_esp32_led():
    """Send command to ESP32 to flash LED"""
    try:
        sock.sendto(b"FLASH_LED", (ESP32_IP, ESP32_PORT))
        logger.info("📡 Signal sent to ESP32 to flash LED")
    except Exception as e:
        logger.warning(f"⚠️ Error sending to ESP32: {e}")


# ------------------------------
# OCR Setup
# ------------------------------
reader = easyocr.Reader(['en'], gpu=False)
plate_pattern = re.compile(r'[A-Z0-9\-]{4,}', re.I)

def preprocess(img):
    """Convert image to high-contrast for OCR."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 5, 17, 17)  # reduce noise
    _, thresh = cv2.threshold(gray, 0, 255,
                              cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh

def detect_and_read(frame, db):
    """Detect and extract plates from a frame."""
    proc_img = preprocess(frame)
    results = reader.readtext(proc_img)

    detected_texts = []

    for bbox, text, conf in results:
        if conf < 0.3:
            continue
        if plate_pattern.search(text):
            text = text.strip().upper()
            detected_texts.append((bbox, text, conf))

            pts = np.array(bbox).astype(int)
            x, y, w, h = cv2.boundingRect(pts)

            # Check DB
            is_registered = check_plate(db, text)
            if is_registered:
                status = "Plate Registered"
                color = (0, 255, 0)
                flash_esp32_led()   # ✅ Trigger ESP32 LED
                logger.info(f"✅ Detected registered plate: {text} (conf: {conf:.2f})")
            else:
                status = "Plate Not Registered"
                color = (0, 0, 255)
                logger.info(f"❌ Detected unregistered plate: {text} (conf: {conf:.2f})")

            # Draw rectangle
            cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
            cv2.putText(frame, f"{text} ({conf:.2f})",
                        (x, y - 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            cv2.putText(frame, status,
                        (x, y - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    return frame, detected_texts


# ------------------------------
# Main
# ------------------------------
if __name__ == "__main__":
    db = init_db()
    cap = cv2.VideoCapture(0)  # webcam

    if not cap.isOpened():
        print("❌ Could not open webcam")
        exit()

    print("📷 Starting live plate detection... Press 'q' to quit.")

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to grab frame")
            break

        frame = cv2.resize(frame, (640, 480))
        frame_count += 1

        if frame_count % 5 == 0:
            processed_frame, plates = detect_and_read(frame, db)
        else:
            processed_frame, plates = frame, []

        if plates:
            for _, text, conf in plates:
                if check_plate(db, text):
                    print(f"✅ {text} is REGISTERED (conf: {conf:.2f})")
                else:
                    print(f"❌ {text} is NOT REGISTERED (conf: {conf:.2f})")

        try:
            cv2.imshow("Live License Plate Detection", processed_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        except cv2.error:
            # Handle headless environments where imshow is not available
            logger.info("Display not available, running in headless mode.")
            # In headless mode, run indefinitely for continuous processing
            pass  # Continue the loop indefinitely in headless mode

    cap.release()
    try:
        cv2.destroyAllWindows()
    except cv2.error:
        pass
