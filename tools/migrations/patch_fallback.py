import re

with open('src/components/FallbackBoundary.tsx', 'r') as f:
    text = f.read()

text = text.replace('''class FallbackBoundary extends Component<FallbackProps, FallbackState> {''', '''class FallbackBoundary extends React.Component<FallbackProps, FallbackState> {''')

with open('src/components/FallbackBoundary.tsx', 'w') as f:
    f.write(text)
