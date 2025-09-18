import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { useRankings } from '../context/RankingsContext';

const FileUpload = () => {
  const { uploadRankings, loading, error, currentWeek, currentSeason } = useRankings();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setUploadStatus(null);
      setUploadStats(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploadStatus('uploading');
      const result = await uploadRankings(file);
      setUploadStatus('success');
      setUploadStats(result);
      setFile(null);
    } catch (err) {
      setUploadStatus('error');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Box>
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: 'primary.main',
          },
        }}
      >
        <input {...getInputProps()} />
        <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop your file here' : 'Drag & drop your rankings file here'}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          or click to browse (XLSX, XLS, CSV)
        </Typography>
      </Paper>

      {file && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <FileIcon color="action" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1">{file.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {formatFileSize(file.size)}
              </Typography>
            </Box>
            <Chip
              label={`Week ${currentWeek}`}
              color="primary"
              size="small"
            />
            <Chip
              label={`Season ${currentSeason}`}
              color="primary"
              size="small"
              variant="outlined"
            />
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={loading || uploadStatus === 'uploading'}
              startIcon={<UploadIcon />}
            >
              Upload
            </Button>
          </Stack>
        </Paper>
      )}

      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Processing your rankings file...
          </Typography>
        </Box>
      )}

      {uploadStatus === 'success' && uploadStats && (
        <Alert
          severity="success"
          icon={<SuccessIcon />}
          sx={{ mt: 2 }}
        >
          <Typography variant="subtitle2">
            Rankings uploaded successfully!
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Chip label={`${uploadStats.totalPlayers} players`} size="small" />
            <Chip label={`${uploadStats.sheetsProcessed.length} positions`} size="small" />
          </Stack>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default FileUpload;