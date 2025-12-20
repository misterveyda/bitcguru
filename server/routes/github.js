const express = require('express');
const { Octokit } = require('@octokit/rest');

const router = express.Router();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER || 'misterveyda';
const REPO = process.env.GITHUB_REPO || 'bitcguru';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

function requireApiKey(req, res, next) {
  const key = process.env.BACKEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server misconfigured' });
  if (req.get('x-api-key') !== key) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.post('/update-data', requireApiKey, async (req, res) => {
  try {
    const { filePath, content, message } = req.body;
    if (!filePath || typeof content === 'undefined') return res.status(400).json({ error: 'filePath and content required' });

    const path = filePath;
    const base64 = Buffer.from(content).toString('base64');

    try {
      const { data } = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
      const sha = data.sha;
      const response = await octokit.rest.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path,
        message: message || 'Update from frontend',
        content: base64,
        sha,
        branch: BRANCH
      });
      return res.json({ success: true, data: response.data });
    } catch (err) {
      if (err.status === 404) {
        const response = await octokit.rest.repos.createOrUpdateFileContents({
          owner: OWNER,
          repo: REPO,
          path,
          message: message || 'Create from frontend',
          content: base64,
          branch: BRANCH
        });
        return res.json({ success: true, data: response.data });
      }
      throw err;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
