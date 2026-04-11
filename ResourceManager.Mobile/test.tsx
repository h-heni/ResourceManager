import React from 'react';

export default function TestApp() {
  return React.createElement('div', {
    style: { color: 'red', fontSize: '30px' }
  }, 'RED TEST - This should be visible!');
}
