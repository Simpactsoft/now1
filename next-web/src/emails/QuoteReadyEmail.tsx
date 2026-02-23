import * as React from 'react';
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Section,
    Text,
} from '@react-email/components';

interface QuoteReadyEmailProps {
    customerName: string;
    quoteNumber: string;
    totalAmount: string;
    quoteUrl: string;
    organizationName: string;
}

export const QuoteReadyEmail = ({
    customerName,
    quoteNumber,
    totalAmount,
    quoteUrl,
    organizationName = 'NOW System'
}: QuoteReadyEmailProps) => {
    return (
        <Html>
            <Head />
            <Body style={main}>
                <Container style={container}>
                    <Heading style={h1}>Your Quote is Ready</Heading>

                    <Text style={text}>Hi {customerName},</Text>

                    <Text style={text}>
                        We've prepared Quote <strong>{quoteNumber}</strong> for you. The total amount is <strong>{totalAmount}</strong>.
                    </Text>

                    <Section style={buttonContainer}>
                        <Button style={button} href={quoteUrl}>
                            View & Approve Quote
                        </Button>
                    </Section>

                    <Text style={text}>
                        If you have any questions, feel free to reply to this email.
                    </Text>

                    <Text style={footer}>
                        &copy; {new Date().getFullYear()} {organizationName}. All rights reserved.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
};

export default QuoteReadyEmail;

const main = {
    backgroundColor: '#f6f9fc',
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    marginBottom: '64px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
};

const h1 = {
    color: '#333',
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '40px',
    margin: '0 0 20px',
    textAlign: 'center' as const,
};

const text = {
    color: '#525f7f',
    fontSize: '16px',
    lineHeight: '26px',
    textAlign: 'left' as const,
    padding: '0 40px',
};

const buttonContainer = {
    padding: '24px 40px',
    textAlign: 'center' as const,
};

const button = {
    backgroundColor: '#4f46e5',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '12px 24px',
};

const footer = {
    color: '#8898aa',
    fontSize: '12px',
    lineHeight: '16px',
    marginTop: '24px',
    textAlign: 'center' as const,
};
