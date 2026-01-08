import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_app/models/workspace.dart';
import 'package:flutter_app/screens/workspace_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _supabase = Supabase.instance.client;
  List<Workspace> _workspaces = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchWorkspaces();
  }

  Future<void> _fetchWorkspaces() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      final response = await _supabase
          .from('workspace_members')
          .select('workspaces (*)')
          .eq('user_id', userId);

      final List<dynamic> data = response as List<dynamic>;
      setState(() {
        _workspaces = data.map((item) => Workspace.fromJson(item['workspaces'])).toList();
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error fetching workspaces: $e')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workspaces'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await _supabase.auth.signOut();
              if (mounted) {
                Navigator.of(context).pushReplacementNamed('/');
              }
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _workspaces.isEmpty
              ? const Center(child: Text('No workspaces found'))
              : ListView.builder(
                  itemCount: _workspaces.length,
                  itemBuilder: (context, index) {
                    final workspace = _workspaces[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF611f69),
                        child: Text(workspace.name[0].toUpperCase(), style: const TextStyle(color: Colors.white)),
                      ),
                      title: Text(workspace.name),
                      subtitle: Text(workspace.slug),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => WorkspaceScreen(workspace: workspace),
                          ),
                        );
                      },
                    );
                  },
                ),
    );
  }
}
