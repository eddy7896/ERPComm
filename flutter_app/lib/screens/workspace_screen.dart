import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:ERPComm/models/workspace.dart';
import 'package:ERPComm/models/channel.dart';
import 'package:ERPComm/screens/channel_screen.dart';

class WorkspaceScreen extends StatefulWidget {
  final Workspace workspace;
  const WorkspaceScreen({super.key, required this.workspace});

  @override
  State<WorkspaceScreen> createState() => _WorkspaceScreenState();
}

class _WorkspaceScreenState extends State<WorkspaceScreen> {
  final _supabase = Supabase.instance.client;
  List<Channel> _channels = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchChannels();
  }

  Future<void> _fetchChannels() async {
    try {
      final response = await _supabase
          .from('channels')
          .select()
          .eq('workspace_id', widget.workspace.id);

      final List<dynamic> data = response as List<dynamic>;
      setState(() {
        _channels = data.map((item) => Channel.fromJson(item)).toList();
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error fetching channels: $e')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.workspace.name),
        backgroundColor: const Color(0xFF611f69),
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(
                    'Channels',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                ),
                ..._channels.map((channel) => ListTile(
                      leading: const Icon(Icons.tag),
                      title: Text(channel.name),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => ChannelScreen(channel: channel),
                          ),
                        );
                      },
                    )),
              ],
            ),
    );
  }
}
