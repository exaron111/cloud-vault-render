import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dccibbvjh',
  api_key: process.env.CLOUDINARY_API_KEY || '485269926154374',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'RW-AtaTeeup3Wv3XeYVTBWz9oHE'
});

export const storage = {
  async uploadFile(fileBuffer, originalName, mimetype) {
    try {
      const safeName = originalName.replace(/[^\w\.\-]/g, '_');
      
      const result = await cloudinary.uploader.upload(
        `data:${mimetype};base64,${fileBuffer.toString('base64')}`,
        {
          folder: 'cloud-vault',
          public_id: `${Date.now()}-${safeName.replace(/\.[^/.]+$/, "")}`,
          resource_type: 'auto',
          overwrite: false
        }
      );
      
      console.log('✅ Файл загружен в Cloudinary:', result.public_id);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        success: true
      };
    } catch (error) {
      console.error('❌ Ошибка Cloudinary:', error.message);
      return {
        url: `data:${mimetype};base64,[truncated]`,
        publicId: null,
        success: false,
        error: error.message
      };
    }
  },

  async deleteFile(publicId) {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  }
};
