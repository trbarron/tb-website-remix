import path from 'path';

export default {
  deploy: {
    start: ({ arc, inventory }) => {
      const sourceDir = 'public/build';
      const destDir = path.join('.arc', 'static', 'build');
      
      if (fs.existsSync(sourceDir)) {
        copyDirectory(sourceDir, destDir);
      } else {
        console.error('Source directory does not exist:', sourceDir);
      }
    }
  }
};