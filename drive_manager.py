"""
CT Studio - Google Drive Manager
จัดการการอัพโหลดและจัดเก็บรูปภาพลูกค้าใน Google Drive
"""

from typing import List, Dict, Optional, Tuple
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from googleapiclient.errors import HttpError
import io
from ct_logger import get_logger

# Initialize logger
logger = get_logger()

class DriveManager:
    """คลาสสำหรับจัดการ Google Drive"""

    def __init__(self, drive_service):
        """
        Args:
            drive_service: Google Drive API service instance
        """
        self.service = drive_service
        self.main_folder_name = "CT Studio - Customer Photos"
        self.main_folder_id = None
        logger.info("DriveManager initialized")

    def get_or_create_main_folder(self) -> str:
        """
        หาหรือสร้างโฟลเดอร์หลัก "CT Studio - Customer Photos"

        Returns:
            str: folder_id ของโฟลเดอร์หลัก
        """
        try:
            # ค้นหาโฟลเดอร์หลักที่มีอยู่
            logger.info(f"Searching for main folder: {self.main_folder_name}")

            query = f"name='{self.main_folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)'
            ).execute()

            folders = results.get('files', [])

            if folders:
                # ถ้าเจอโฟลเดอร์แล้ว ใช้โฟลเดอร์นั้น
                self.main_folder_id = folders[0]['id']
                logger.info(f"Main folder found: {self.main_folder_id}")
                return self.main_folder_id
            else:
                # ถ้าไม่เจอ สร้างโฟลเดอร์ใหม่
                logger.info("Main folder not found, creating new one")
                folder_metadata = {
                    'name': self.main_folder_name,
                    'mimeType': 'application/vnd.google-apps.folder'
                }

                folder = self.service.files().create(
                    body=folder_metadata,
                    fields='id'
                ).execute()

                self.main_folder_id = folder.get('id')
                logger.info(f"Main folder created: {self.main_folder_id}")
                return self.main_folder_id

        except HttpError as e:
            logger.error(f"Error accessing main folder: {e}")
            raise Exception(f"ไม่สามารถเข้าถึงโฟลเดอร์หลักได้: {str(e)}")

    def get_or_create_customer_folder(self, customer_id: str, customer_name: str) -> Tuple[str, str]:
        """
        หาหรือสร้างโฟลเดอร์ลูกค้า

        Args:
            customer_id: รหัสลูกค้า เช่น "CUST-001"
            customer_name: ชื่อลูกค้า

        Returns:
            Tuple[str, str]: (folder_id, folder_url)
        """
        try:
            # ตรวจสอบว่ามีโฟลเดอร์หลักหรือยัง
            if not self.main_folder_id:
                self.get_or_create_main_folder()

            # ชื่อโฟลเดอร์ลูกค้า: "CUST-XXX - ชื่อลูกค้า"
            folder_name = f"{customer_id} - {customer_name}"
            logger.info(f"Searching for customer folder: {folder_name}")

            # ค้นหาโฟลเดอร์ลูกค้าที่มีอยู่
            query = f"name='{folder_name}' and '{self.main_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, webViewLink)'
            ).execute()

            folders = results.get('files', [])

            if folders:
                # ถ้าเจอโฟลเดอร์แล้ว
                folder_id = folders[0]['id']
                folder_url = folders[0].get('webViewLink', '')
                logger.info(f"Customer folder found: {folder_id}")
                return folder_id, folder_url
            else:
                # สร้างโฟลเดอร์ใหม่
                logger.info("Customer folder not found, creating new one")
                folder_metadata = {
                    'name': folder_name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [self.main_folder_id]
                }

                folder = self.service.files().create(
                    body=folder_metadata,
                    fields='id, webViewLink'
                ).execute()

                folder_id = folder.get('id')
                folder_url = folder.get('webViewLink', '')
                logger.info(f"Customer folder created: {folder_id}")
                return folder_id, folder_url

        except HttpError as e:
            logger.error(f"Error managing customer folder: {e}")
            raise Exception(f"ไม่สามารถจัดการโฟลเดอร์ลูกค้าได้: {str(e)}")

    def upload_image(self, file_content, filename: str, folder_id: str, mime_type: str = 'image/jpeg') -> Dict:
        """
        อัพโหลดรูปภาพไปยัง Google Drive

        Args:
            file_content: เนื้อหาไฟล์ (bytes หรือ file object)
            filename: ชื่อไฟล์
            folder_id: ID ของโฟลเดอร์ที่จะอัพโหลด
            mime_type: ประเภทไฟล์

        Returns:
            Dict: ข้อมูลไฟล์ที่อัพโหลด (id, name, webViewLink, webContentLink)
        """
        try:
            logger.info(f"Uploading image: {filename} to folder: {folder_id}")

            # ตั้งค่า metadata ของไฟล์
            file_metadata = {
                'name': filename,
                'parents': [folder_id]
            }

            # สร้าง media upload
            if isinstance(file_content, bytes):
                media = MediaIoBaseUpload(
                    io.BytesIO(file_content),
                    mimetype=mime_type,
                    resumable=True
                )
            else:
                # ถ้าเป็น file object
                media = MediaIoBaseUpload(
                    file_content,
                    mimetype=mime_type,
                    resumable=True
                )

            # อัพโหลดไฟล์
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink, thumbnailLink'
            ).execute()

            logger.info(f"Image uploaded successfully: {file.get('id')}")

            return {
                'id': file.get('id'),
                'name': file.get('name'),
                'webViewLink': file.get('webViewLink'),
                'webContentLink': file.get('webContentLink'),
                'thumbnailLink': file.get('thumbnailLink')
            }

        except HttpError as e:
            logger.error(f"Error uploading image: {e}")
            raise Exception(f"ไม่สามารถอัพโหลดรูปภาพได้: {str(e)}")

    def list_images(self, folder_id: str) -> List[Dict]:
        """
        แสดงรายการรูปภาพทั้งหมดในโฟลเดอร์

        Args:
            folder_id: ID ของโฟลเดอร์

        Returns:
            List[Dict]: รายการไฟล์ (id, name, webViewLink, thumbnailLink, createdTime)
        """
        try:
            logger.info(f"Listing images in folder: {folder_id}")

            # ค้นหาไฟล์รูปภาพในโฟลเดอร์
            query = f"'{folder_id}' in parents and (mimeType contains 'image/') and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, webViewLink, webContentLink, thumbnailLink, createdTime, size)',
                orderBy='createdTime desc'
            ).execute()

            files = results.get('files', [])
            logger.info(f"Found {len(files)} images")

            return files

        except HttpError as e:
            logger.error(f"Error listing images: {e}")
            raise Exception(f"ไม่สามารถแสดงรายการรูปภาพได้: {str(e)}")

    def delete_image(self, file_id: str) -> bool:
        """
        ลบรูปภาพ

        Args:
            file_id: ID ของไฟล์ที่จะลบ

        Returns:
            bool: True ถ้าลบสำเร็จ
        """
        try:
            logger.info(f"Deleting image: {file_id}")

            self.service.files().delete(fileId=file_id).execute()

            logger.info(f"Image deleted successfully: {file_id}")
            return True

        except HttpError as e:
            logger.error(f"Error deleting image: {e}")
            raise Exception(f"ไม่สามารถลบรูปภาพได้: {str(e)}")

    def get_folder_url(self, folder_id: str) -> str:
        """
        ดึง URL ของโฟลเดอร์

        Args:
            folder_id: ID ของโฟลเดอร์

        Returns:
            str: URL ของโฟลเดอร์
        """
        try:
            file = self.service.files().get(
                fileId=folder_id,
                fields='webViewLink'
            ).execute()

            return file.get('webViewLink', '')

        except HttpError as e:
            logger.error(f"Error getting folder URL: {e}")
            return ""


# สร้าง instance ของ DriveManager
def get_drive_manager():
    """
    สร้างและคืนค่า DriveManager instance

    Returns:
        DriveManager: instance ของ DriveManager
    """
    from config import drive_service
    return DriveManager(drive_service)
