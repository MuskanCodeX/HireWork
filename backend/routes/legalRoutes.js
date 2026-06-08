const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const getLegalPage = (pageName) => {
    const filePath = path.join(__dirname, '..', `${pageName.toUpperCase()}.md`);
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return { content, found: true };
        }
    } catch (err) {
        console.error(`Error reading ${pageName}:`, err);
    }
    return { content: null, found: false };
};

router.get('/privacy', (req, res) => {
    const { content, found } = getLegalPage('privacy_policy');
    
    if (!found) {
        return res.status(404).json({ message: 'Privacy Policy not found' });
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - HIREWORK</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.8; 
            color: #333; 
            background: #f5f5f5;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 60px 20px; 
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .content { 
            background: white; 
            padding: 40px; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .content h2 { 
            color: #667eea; 
            margin: 30px 0 15px; 
            font-size: 1.4rem;
        }
        .content h3 { 
            color: #444; 
            margin: 20px 0 10px; 
            font-size: 1.1rem;
        }
        .content p { margin-bottom: 15px; }
        .content ul { margin-left: 20px; margin-bottom: 15px; }
        .content li { margin-bottom: 8px; }
        .content table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .content th, .content td { 
            padding: 12px; 
            border: 1px solid #ddd; 
            text-align: left; 
        }
        .content th { background: #f5f5f5; }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            color: #666; 
            padding: 20px;
        }
        .footer a { color: #667eea; text-decoration: none; }
        .last-updated { color: #888; font-size: 0.9rem; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Privacy Policy</h1>
        <p>HIREWORK - Your Trusted Freelancing Platform</p>
    </div>
    <div class="container">
        <div class="content">
            ${content.split('\n').map(line => {
                if (line.startsWith('## ')) return `<h2>${line.replace('## ', '')}</h2>`;
                if (line.startsWith('### ')) return `<h3>${line.replace('### ', '')}</h3>`;
                if (line.startsWith('- ')) return `<li>${line.replace('- ', '')}</li>`;
                if (line.trim()) return `<p>${line}</p>`;
                return '';
            }).join('')}
        </div>
        <div class="footer">
            <p>&copy; 2026 HIREWORK. All rights reserved.</p>
            <p><a href="/terms">Terms of Service</a> | <a href="/">Home</a></p>
            <p class="last-updated">Last Updated: March 2026</p>
        </div>
    </div>
</body>
</html>
    `);
});

router.get('/terms', (req, res) => {
    const { content, found } = getLegalPage('terms_of_service');
    
    if (!found) {
        return res.status(404).json({ message: 'Terms of Service not found' });
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - HIREWORK</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.8; 
            color: #333; 
            background: #f5f5f5;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
            color: white; 
            padding: 60px 20px; 
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .content { 
            background: white; 
            padding: 40px; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .content h2 { 
            color: #f5576c; 
            margin: 30px 0 15px; 
            font-size: 1.4rem;
        }
        .content h3 { 
            color: #444; 
            margin: 20px 0 10px; 
            font-size: 1.1rem;
        }
        .content p { margin-bottom: 15px; }
        .content ul { margin-left: 20px; margin-bottom: 15px; }
        .content li { margin-bottom: 8px; }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            color: #666; 
            padding: 20px;
        }
        .footer a { color: #f5576c; text-decoration: none; }
        .last-updated { color: #888; font-size: 0.9rem; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Terms of Service</h1>
        <p>Rules and Guidelines for Using HIREWORK</p>
    </div>
    <div class="container">
        <div class="content">
            ${content.split('\n').map(line => {
                if (line.startsWith('## ')) return `<h2>${line.replace('## ', '')}</h2>`;
                if (line.startsWith('### ')) return `<h3>${line.replace('### ', '')}</h3>`;
                if (line.startsWith('- ')) return `<li>${line.replace('- ', '')}</li>`;
                if (line.trim()) return `<p>${line}</p>`;
                return '';
            }).join('')}
        </div>
        <div class="footer">
            <p>&copy; 2026 HIREWORK. All rights reserved.</p>
            <p><a href="/privacy">Privacy Policy</a> | <a href="/">Home</a></p>
            <p class="last-updated">Last Updated: March 2026</p>
        </div>
    </div>
</body>
</html>
    `);
});

module.exports = router;
