import React from 'react';
import { 
  Badge, 
  HStack, 
  Text 
} from '@chakra-ui/react';
import { 
  CheckCircleIcon, 
  WarningIcon, 
  SpinnerIcon, 
  TimeIcon, 
  InfoIcon 
} from '@chakra-ui/icons';

export const useStatus = () => {
  // Status color mapping
  const getStatusColor = (status) => {
    const statusColors = {
      'success': 'green',
      'completed': 'green',
      'in_progress': 'blue',
      'running': 'blue',
      'failed': 'red',
      'error': 'red',
      'pending': 'gray',
      'queued': 'gray',
      'paused': 'yellow'
    };
    
    return statusColors[status.toLowerCase()] || 'gray';
  };

  // Status icon mapping
  const getStatusIcon = (status) => {
    const statusIcons = {
      'success': CheckCircleIcon,
      'completed': CheckCircleIcon,
      'in_progress': SpinnerIcon,
      'running': SpinnerIcon,
      'failed': WarningIcon,
      'error': WarningIcon,
      'pending': TimeIcon,
      'queued': TimeIcon,
      'paused': InfoIcon
    };
    
    return statusIcons[status.toLowerCase()] || InfoIcon;
  };

  // Render status badge
  const StatusBadge = ({ status, ...rest }) => {
    const color = getStatusColor(status);
    const Icon = getStatusIcon(status);

    return (
      <Badge 
        colorScheme={color} 
        {...rest}
      >
        <HStack spacing={1} align="center">
          <Icon />
          <Text textTransform="capitalize">
            {status.replace(/_/g, ' ')}
          </Text>
        </HStack>
      </Badge>
    );
  };

  return {
    getStatusColor,
    getStatusIcon,
    StatusBadge
  };
};
