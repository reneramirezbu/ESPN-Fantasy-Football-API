import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  Box,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useRankings } from '../context/RankingsContext';

const NameResolver = ({ open, onClose, unmatchedPlayers = [] }) => {
  const { manualPlayerMapping } = useRankings();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMappings, setSelectedMappings] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const filteredPlayers = unmatchedPlayers.filter(
    (player) =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleManualMapping = (playerKey, espnId, espnName) => {
    setSelectedMappings((prev) => ({
      ...prev,
      [playerKey]: { espnId, espnName },
    }));
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    setError(null);

    try {
      const mappingPromises = Object.entries(selectedMappings).map(
        ([playerKey, { espnId, espnName }]) =>
          manualPlayerMapping(playerKey, espnId, espnName)
      );

      await Promise.all(mappingPromises);
      onClose();
    } catch (err) {
      setError('Failed to save mappings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'error';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Resolve Player Names</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          size="small"
          placeholder="Search unmatched players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {filteredPlayers.length} unmatched players found. Click to manually map them to ESPN players.
        </Typography>

        <List>
          {filteredPlayers.map((player) => {
            const playerKey = `${player.name}_${player.team}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const isSelected = !!selectedMappings[playerKey];

            return (
              <ListItem
                key={playerKey}
                sx={{
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: isSelected ? 'action.hover' : 'background.paper',
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1">{player.name}</Typography>
                      {player.team && (
                        <Chip label={player.team} size="small" variant="outlined" />
                      )}
                      {player.position && (
                        <Chip label={player.position} size="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    player.suggestions && player.suggestions.length > 0 ? (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          Suggested matches:
                        </Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          {player.suggestions.slice(0, 3).map((suggestion) => (
                            <Chip
                              key={suggestion.espnId}
                              label={suggestion.espnName}
                              size="small"
                              color={getConfidenceColor(suggestion.confidence)}
                              variant="outlined"
                              onClick={() =>
                                handleManualMapping(
                                  playerKey,
                                  suggestion.espnId,
                                  suggestion.espnName
                                )
                              }
                              icon={<LinkIcon />}
                            />
                          ))}
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="error">
                        No suggestions available
                      </Typography>
                    )
                  }
                />
                <ListItemSecondaryAction>
                  {isSelected && (
                    <IconButton color="primary" size="small">
                      <CheckIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>

        {filteredPlayers.length === 0 && (
          <Box textAlign="center" py={3}>
            <Typography variant="body1" color="textSecondary">
              No unmatched players found
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSaveMappings}
          disabled={Object.keys(selectedMappings).length === 0 || saving}
        >
          Save Mappings ({Object.keys(selectedMappings).length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NameResolver;