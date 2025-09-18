import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Button,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  Upload as UploadIcon,
  TableChart as TableIcon,
  Delete as DeleteIcon,
  Groups as TeamIcon,
  SportsFootball as FootballIcon,
  Menu as MenuIcon,
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
  const [currentTab, setCurrentTab] = useState(0);
  const [nameResolverOpen, setNameResolverOpen] = useState(false);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

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

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleMobileMenuItemClick = (index) => {
    setCurrentTab(index);
    handleMobileMenuClose();
  };

  const tabs = [
    { label: 'My Team', icon: <TeamIcon /> },
    { label: 'Rankings', icon: <TableIcon /> },
    { label: 'Upload', icon: <UploadIcon /> },
    { label: 'Optimize', icon: <FootballIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />

      <AppBar position="fixed">
        <Toolbar>
          <FootballIcon sx={{ mr: 2 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Fantasy Football Dashboard
          </Typography>
          <WeekSelector />
          {isMobile && (
            <IconButton
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={handleMobileMenuOpen}
              sx={{ ml: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
        {!isMobile && (
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ bgcolor: 'primary.dark' }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            ))}
          </Tabs>
        )}
      </AppBar>

      <Menu
        anchorEl={mobileMenuAnchor}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMobileMenuClose}
      >
        {tabs.map((tab, index) => (
          <MenuItem
            key={index}
            onClick={() => handleMobileMenuItemClick(index)}
            selected={currentTab === index}
          >
            <ListItemIcon>{tab.icon}</ListItemIcon>
            <ListItemText>{tab.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: isMobile ? '64px' : '112px' }}>
        <Container maxWidth="xl">
          {currentTab === 0 && <MyTeam />}

          {currentTab === 1 && (
            <>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">
                    Week {currentWeek} Rankings
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    {rankings && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteCurrent}
                      >
                        Delete Rankings
                      </Button>
                    )}
                    {!rankings && availableRankings.length === 0 && (
                      <Button
                        variant="contained"
                        startIcon={<UploadIcon />}
                        onClick={() => setCurrentTab(2)}
                      >
                        Upload First Rankings
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
              <RankingsTable />
            </>
          )}

          {currentTab === 2 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                Upload Rankings
              </Typography>
              <FileUpload />
            </Paper>
          )}

          {currentTab === 3 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Lineup Optimizer
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
                The optimizer will help you set your best lineup based on weekly rankings.
              </Typography>
              <Typography variant="body2" color="primary">
                Coming in Phase 3: Automatic lineup optimization based on rankings
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
