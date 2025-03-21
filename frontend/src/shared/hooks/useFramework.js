import React from 'react';
import { 
  Box, 
  Tooltip, 
  Icon 
} from '@chakra-ui/react';
import { 
  DiPython, 
  DiReact, 
  DiNodejs 
} from 'react-icons/di';

export const useFramework = () => {
  // Framework color mapping
  const getFrameworkColor = (framework) => {
    const frameworkColors = {
      'langgraph': 'blue',
      'crewai': 'purple',
      'autogen': 'green',
      'langchain': 'teal',
      'python': 'blue',
      'javascript': 'yellow',
      'nodejs': 'green'
    };
    
    return frameworkColors[framework.toLowerCase()] || 'gray';
  };

  // Framework icon mapping
  const getFrameworkIcon = (framework) => {
    const frameworkIcons = {
      'python': DiPython,
      'javascript': DiReact,
      'nodejs': DiNodejs,
      'langgraph': DiPython,
      'crewai': DiPython,
      'autogen': DiPython,
      'langchain': DiPython
    };
    
    return frameworkIcons[framework.toLowerCase()] || DiPython;
  };

  // Render framework badge
  const FrameworkBadge = ({ framework, ...rest }) => {
    const color = getFrameworkColor(framework);
    const FrameworkIcon = getFrameworkIcon(framework);

    return (
      <Tooltip label={framework}>
        <Box 
          as="span" 
          display="inline-flex" 
          alignItems="center" 
          {...rest}
        >
          <Icon 
            as={FrameworkIcon} 
            color={`${color}.500`} 
            w={5} 
            h={5} 
          />
        </Box>
      </Tooltip>
    );
  };

  return {
    getFrameworkColor,
    getFrameworkIcon,
    FrameworkBadge
  };
};
