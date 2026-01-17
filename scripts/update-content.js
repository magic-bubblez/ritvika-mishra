require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser();

// CONFIG
const GITHUB_USERNAME = 'magic-bubblez';
const MEDIUM_USERNAME = 'ritvika780'; // From existing links
// TODO: Replace with actual Bear Blog URL if available, or leave empty
const BEAR_BLOG_RSS = 'https://magic-bubblez.bearblog.dev/feed/';
// Files to update
const WORK_HTML_PATH = path.join(__dirname, '../html/work.html');
const BLOG_HTML_PATH = path.join(__dirname, '../html/blog.html');

async function getGitHubRepos() {
    try {
        const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=pushed&per_page=10`;
        const headers = {};
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }
        const response = await axios.get(url, { headers });
        // Filter: not forked, has description
        const repos = response.data.filter(repo => !repo.fork && repo.description).slice(0, 8);
        return repos;
    } catch (error) {
        console.error('Error fetching GitHub repos:', error.message);
        return [];
    }
}

async function getRSSFeed(url) {
    if (!url) return [];
    try {
        const feed = await parser.parseURL(url);
        return feed.items.map(item => ({
            title: item.title,
            link: item.link,
            date: new Date(item.pubDate || item.isoDate || new Date()).toISOString().split('T')[0]
        }));
    } catch (error) {
        console.error(`Error fetching RSS from ${url}:`, error.message);
        return [];
    }
}

async function updateFile(filePath, startMarker, endMarker, content) {
    try {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');

        if (!fileContent.match(regex)) {
            console.warn(`Markers not found in ${filePath}`);
            return;
        }

        const newContent = `${startMarker}\n${content}\n${endMarker}`;
        fileContent = fileContent.replace(regex, newContent);
        fs.writeFileSync(filePath, fileContent);
        console.log(`Updated ${filePath}`);
    } catch (error) {
        console.error(`Error updating ${filePath}:`, error.message);
    }
}

async function main() {
    // 1. Update Projects in work.html
    console.log('Fetching GitHub repos...');
    const repos = await getGitHubRepos();
    if (repos.length > 0) {
        let repoHtml = `<p style="font-family: 'Inter', sans-serif; font-size: 19px; line-height: 1.5; text-decoration: none;">`;
        repos.forEach(repo => {
            // Cleaning description to be safe
            const desc = repo.description ? repo.description.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            repoHtml += `> <a href="${repo.html_url}" target="_blank">${repo.name} - ${desc}</a><br>\n`;
        });
        repoHtml += `<br><br>For more projects, visit my <a href="https://github.com/${GITHUB_USERNAME}" target="_blank">GitHub :)</a></p>`;

        await updateFile(WORK_HTML_PATH, '<!-- AUTOMATED_REPOS_START -->', '<!-- AUTOMATED_REPOS_END -->', repoHtml);
    }

    // 2. Update Blogs in blog.html
    console.log('Fetching Blog posts...');
    const mediumUrl = `https://medium.com/feed/@${MEDIUM_USERNAME}`;
    const mediumPosts = await getRSSFeed(mediumUrl);
    const bearPosts = await getRSSFeed(BEAR_BLOG_RSS);

    // Combine and sort by date descending
    const allPosts = [...mediumPosts, ...bearPosts].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allPosts.length > 0) {
        let blogListHtml = '';
        allPosts.forEach(post => {
            blogListHtml += `
        <li class="blog-item">
            <span class="blog-date">${post.date}</span>
            <span class="blog-title"><a href="${post.link}" target="_blank">${post.title}</a></span>
        </li>\n`;
        });
        // Append static links if needed, or better yet, keep them in a separate static block if the user wants purely static + dynamic. 
        // For now, I'm replacing the automated block.

        await updateFile(BLOG_HTML_PATH, '<!-- AUTOMATED_BLOGS_START -->', '<!-- AUTOMATED_BLOGS_END -->', blogListHtml);
    }
}

main();
