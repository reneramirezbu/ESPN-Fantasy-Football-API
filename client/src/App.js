import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Button,
  Stack,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Upload as UploadIcon,
  TableChart as TableIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Compare as CompareIcon,
  Groups as TeamIcon,
} from '@mui/icons-material';
import { RankingsProvider, useRankings } from './context/RankingsContext';
import FileUpload from './components/FileUpload';
import WeekSelector from './components/WeekSelector';
import RankingsTable from './components/RankingsTable';
import NameResolver from './components/NameResolver';
import MyTeam from './components/MyTeam';

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
    background: {
      default: '#f5f5f5',
    },
  },
});

const MainContent = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState('rankings');
  const [nameResolverOpen, setNameResolverOpen] = useState(false);
  const {
    rankings,
    currentWeek,
    currentSeason,
    deleteRankings,
    availableRankings,
    fetchAvailableRankings,
  } = useRankings();

  const handleDeleteCurrent = async () => {
    if (window.confirm(`Delete rankings for Week ${currentWeek}, Season ${currentSeason}?`)) {
      await deleteRankings(currentWeek, currentSeason);
      await fetchAvailableRankings();
    }
  };

  const menuItems = [
    { text: 'My Team', icon: <TeamIcon />, view: 'myteam' },
    { text: 'Rankings', icon: <TableIcon />, view: 'rankings' },
    { text: 'Upload', icon: <UploadIcon />, view: 'upload' },
    { text: 'Compare Weeks', icon: <CompareIcon />, view: 'compare' },
    { text: 'Settings', icon: <SettingsIcon />, view: 'settings' },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Fantasy Football Rankings Manager
          </Typography>
          <WeekSelector />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => {
                  setCurrentView(item.view);
                  setDrawerOpen(false);
                }}
                selected={currentView === item.view}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
          <Divider />
          <List>
            <ListItem
              button
              onClick={() => setNameResolverOpen(true)}
            >
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Name Resolver" />
            </ListItem>
            {rankings && (
              <ListItem
                button
                onClick={handleDeleteCurrent}
              >
                <ListItemIcon>
                  <DeleteIcon />
                </ListItemIcon>
                <ListItemText primary="Delete Current" />
              </ListItem>
            )}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Container maxWidth="xl">
          {currentView === 'myteam' && (
            <MyTeam />
          )}

          {currentView === 'upload' && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                Upload Rankings
              </Typography>
              <FileUpload />
            </Paper>
          )}

          {currentView === 'rankings' && (
            <>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">
                    Week {currentWeek} Rankings
                  </Typography>
                  {!rankings && availableRankings.length === 0 && (
                    <Button
                      variant="contained"
                      startIcon={<UploadIcon />}
                      onClick={() => setCurrentView('upload')}
                    >
                      Upload First Rankings
                    </Button>
                  )}
                </Stack>
              </Paper>
              <RankingsTable />
            </>
          )}

          {currentView === 'compare' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Compare Weeks
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Week comparison feature coming soon. This will allow you to see rank changes
                between multiple weeks.
              </Typography>
            </Paper>
          )}

          {currentView === 'settings' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Settings
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configure your ESPN league settings and name mappings here.
              </Typography>
            </Paper>
          )}
        </Container>
      </Box>

      <NameResolver
        open={nameResolverOpen}
        onClose={() => setNameResolverOpen(false)}
        unmatchedPlayers={[]}
      />
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <RankingsProvider>
        <MainContent />
      </RankingsProvider>
    </ThemeProvider>
  );
}

export default App;
